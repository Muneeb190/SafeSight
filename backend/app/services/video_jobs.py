from __future__ import annotations

import asyncio
import logging
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2

from app.config import Settings
from app.database import InspectionStore
from app.detector import DetectionEngine
from app.safety_rules import assess_safety
from app.schemas import Detection
from app.storage import EvidenceStorage
from app.services.uploads import VideoMetadata

logger = logging.getLogger(__name__)


@dataclass
class VideoJob:
    job_id: str
    inspection_id: str
    user_id: str
    workplace_id: str
    store_history: bool = True
    status: str = "queued"
    progress: float = 0
    frames_processed: int = 0
    total_frames: int = 0
    error: str | None = None
    result_path: Path | None = None
    created_at: float = field(default_factory=time.time)


class VideoJobManager:
    def __init__(
        self,
        *,
        settings: Settings,
        detector: DetectionEngine,
        store: InspectionStore,
        storage: EvidenceStorage | None,
    ) -> None:
        self.settings = settings
        self.detector = detector
        self.store = store
        self.storage = storage
        self.jobs: dict[str, VideoJob] = {}
        self.lock = threading.Lock()
        self.semaphore = asyncio.Semaphore(settings.video_workers)
        self.tasks: set[asyncio.Task[None]] = set()
        self.sweeper: asyncio.Task[None] | None = None

    def start_sweeper(self) -> None:
        self.sweeper = asyncio.create_task(self._cleanup_loop(), name="safesight-video-job-cleanup")

    def start(
        self,
        *,
        input_path: Path,
        metadata: VideoMetadata,
        user_id: str,
        workplace_id: str,
        confidence: float,
        store_history: bool = True,
    ) -> VideoJob:
        self._expire_old_jobs()
        job = VideoJob(
            job_id=str(uuid.uuid4()),
            inspection_id=str(uuid.uuid4()),
            user_id=user_id,
            workplace_id=workplace_id,
            store_history=store_history,
            total_frames=metadata.frame_count,
        )
        with self.lock:
            self.jobs[job.job_id] = job
        task = asyncio.create_task(
            self._run(job, input_path, metadata, confidence),
            name=f"safesight-video-{job.job_id}",
        )
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)
        return job

    def get_for_owner(
        self, job_id: str, *, user_id: str, workplace_id: str
    ) -> VideoJob | None:
        self._expire_old_jobs()
        with self.lock:
            job = self.jobs.get(job_id)
            if job is None or job.user_id != user_id or job.workplace_id != workplace_id:
                return None
            return job

    async def shutdown(self) -> None:
        if self.sweeper is not None:
            self.sweeper.cancel()
            await asyncio.gather(self.sweeper, return_exceptions=True)
        for task in list(self.tasks):
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        with self.lock:
            jobs = list(self.jobs.values())
            self.jobs.clear()
        for job in jobs:
            if job.result_path is not None:
                job.result_path.unlink(missing_ok=True)

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(min(60, self.settings.job_retention_seconds))
            self._expire_old_jobs()

    async def _run(
        self,
        job: VideoJob,
        input_path: Path,
        metadata: VideoMetadata,
        confidence: float,
    ) -> None:
        file_descriptor, raw_output_path = tempfile.mkstemp(
            prefix="safesight-annotated-", suffix=".mp4"
        )
        import os

        os.close(file_descriptor)
        output_path = Path(raw_output_path)
        try:
            async with self.semaphore:
                self._update(job, status="processing")
                detections = await asyncio.to_thread(
                    self._process_video,
                    input_path,
                    output_path,
                    metadata,
                    confidence,
                    job,
                )
            evidence_reference = None
            if self.storage is not None:
                evidence_reference = await asyncio.to_thread(
                    self.storage.put_file,
                    output_path,
                    content_type="video/mp4",
                    suffix="mp4",
                )
            assessment = assess_safety(
                list(self.detector.class_names.values()),
                detections,
            )
            if job.store_history:
                try:
                    await asyncio.to_thread(
                        self.store.save,
                        {
                            "inspection_id": job.inspection_id,
                            "user_id": job.user_id,
                            "workplace_id": job.workplace_id,
                            "source": "video",
                            "created_at": datetime.now(timezone.utc),
                            "model_version": self.detector.model_version or "unversioned",
                            "detections": [
                                item.model_dump(mode="json") for item in detections[:100]
                            ],
                            "detection_summary": _summarize_detections(detections),
                            "safety_assessment": assessment.model_dump(mode="json"),
                            "review_status": "requires_review",
                            "evidence_reference": evidence_reference,
                        },
                    )
                except RuntimeError as exc:
                    # Persistence is optional in local inference development.
                    if self.settings.mongodb_uri:
                        raise
                    logger.info("video_history_not_saved", extra={"reason": str(exc)})
                except Exception:
                    logger.exception("video_inspection_save_failed")
                    if self.settings.require_database:
                        raise
            self._update(
                job,
                status="completed",
                progress=100,
                result_path=output_path,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("video_job_failed", extra={"job_id": job.job_id})
            output_path.unlink(missing_ok=True)
            self._update(
                job,
                status="failed",
                error=f"Video processing failed: {type(exc).__name__}: {exc}",
            )
        finally:
            input_path.unlink(missing_ok=True)
            current = self.get_for_owner(
                job.job_id,
                user_id=job.user_id,
                workplace_id=job.workplace_id,
            )
            if current is None or current.status != "completed":
                output_path.unlink(missing_ok=True)

    def _process_video(
        self,
        input_path: Path,
        output_path: Path,
        metadata: VideoMetadata,
        confidence: float,
        job: VideoJob,
    ) -> list[Detection]:
        capture = cv2.VideoCapture(str(input_path))
        if not capture.isOpened():
            capture.release()
            raise RuntimeError("OpenCV could not reopen the validated input video.")

        writer = cv2.VideoWriter(
            str(output_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            metadata.fps,
            (metadata.width, metadata.height),
        )
        if not writer.isOpened():
            capture.release()
            writer.release()
            raise RuntimeError("OpenCV could not create an MP4 output file with the mp4v codec.")

        detections: list[Detection] = []
        frame_index = 0
        try:
            while True:
                readable, frame = capture.read()
                if not readable:
                    break
                if frame_index % self.settings.video_frame_stride == 0:
                    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    prediction = self.detector.predict(image_rgb, confidence)
                    writer.write(prediction.annotated)
                    detections.extend(prediction.detections)
                else:
                    # Non-sampled frames stay unaltered; boxes are not projected
                    # across time because this backend does not track workers.
                    writer.write(frame)
                frame_index += 1
                self._update(
                    job,
                    frames_processed=frame_index,
                    progress=min(99.0, frame_index / metadata.frame_count * 100),
                )
        finally:
            capture.release()
            writer.release()

        if frame_index == 0 or not output_path.is_file() or output_path.stat().st_size == 0:
            raise RuntimeError("No playable annotated frames were produced.")
        return detections

    def _update(self, job: VideoJob, **changes: Any) -> None:
        with self.lock:
            stored = self.jobs.get(job.job_id)
            if stored is None:
                return
            for key, value in changes.items():
                setattr(stored, key, value)

    def _expire_old_jobs(self) -> None:
        cutoff = time.time() - self.settings.job_retention_seconds
        expired: list[VideoJob] = []
        with self.lock:
            for job_id, job in list(self.jobs.items()):
                if job.created_at < cutoff and job.status in {"completed", "failed"}:
                    expired.append(self.jobs.pop(job_id))
        for job in expired:
            if job.result_path is not None:
                job.result_path.unlink(missing_ok=True)


def _summarize_detections(detections: list[Detection]) -> list[dict[str, int | float | str]]:
    aggregates: dict[int, dict[str, Any]] = {}
    for detection in detections:
        item = aggregates.setdefault(
            detection.class_id,
            {"class_name": detection.class_name, "count": 0, "confidence_sum": 0.0},
        )
        item["count"] += 1
        item["confidence_sum"] += detection.confidence
    return [
        {
            "class_id": class_id,
            "class_name": item["class_name"],
            "count": item["count"],
            "mean_confidence": item["confidence_sum"] / item["count"],
        }
        for class_id, item in sorted(aggregates.items())
    ]
