from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import Principal, get_request_principal
from app.config import Settings, get_settings
from app.database import InspectionStore
from app.detector import DetectionEngine, encode_annotated_image
from app.safety_rules import assess_safety
from app.schemas import (
    ErrorBody,
    ErrorResponse,
    HealthResponse,
    ImageDetectionResponse,
    InspectionListResponse,
    InspectionResponse,
    VideoJobResponse,
)
from app.services.uploads import (
    decode_and_validate_image,
    inspect_video,
    read_upload_limited,
    save_upload_to_temp,
)
from app.services.video_jobs import VideoJob, VideoJobManager
from app.storage import EvidenceStorage, create_storage

logger = logging.getLogger("safesight")


class JSONLogFormatter(logging.Formatter):
    _excluded = {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in self._excluded or any(
                sensitive in key.lower() for sensitive in ("secret", "password", "token", "credential", "uri")
            ):
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JSONLogFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    detector = DetectionEngine(settings)
    detector.load()
    if settings.require_model and not detector.is_loaded:
        raise RuntimeError(detector.error or "Required YOLO model could not be loaded.")

    store = InspectionStore(settings)
    store.connect()

    app.state.settings = settings
    app.state.detector = detector
    app.state.store = store
    app.state.storage = create_storage(settings)
    app.state.video_jobs = VideoJobManager(
        settings=settings,
        detector=detector,
        store=store,
        storage=app.state.storage,
    )
    app.state.video_jobs.start_sweeper()
    try:
        yield
    finally:
        await app.state.video_jobs.shutdown()
        store.close()


settings_at_import = get_settings()
app = FastAPI(
    title="SafeSight AI Workplace Safety API",
    version="1.0.0",
    description="Workplace safety image and video detections with human-review-required assessments.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)
cors_origins = settings_at_import.allowed_cors_origins
if not cors_origins or "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class RequestRateLimiter:
    """Small per-process limit for expensive detection routes."""

    def __init__(self) -> None:
        self.requests: dict[str, list[float]] = {}
        self.lock = asyncio.Lock()

    async def check(self, key: str, limit: int) -> bool:
        now = time.monotonic()
        async with self.lock:
            recent = [timestamp for timestamp in self.requests.get(key, []) if now - timestamp < 60]
            if len(recent) >= limit:
                self.requests[key] = recent
                return False
            recent.append(now)
            self.requests[key] = recent
            if len(self.requests) > 10_000:
                self.requests = {
                    client: [timestamp for timestamp in values if now - timestamp < 60]
                    for client, values in self.requests.items()
                    if any(now - timestamp < 60 for timestamp in values)
                }
            return True


rate_limiter = RequestRateLimiter()


@app.middleware("http")
async def request_context_and_rate_limit(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    if request.url.path.startswith("/api/detect/"):
        settings = getattr(request.app.state, "settings", settings_at_import)
        client_key = request.client.host if request.client else "unknown"
        if not await rate_limiter.check(client_key, settings.rate_limit_per_minute):
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limit_exceeded",
                        "message": "Too many detection requests. Try again after one minute.",
                        "request_id": request.state.request_id,
                    }
                },
                headers={"Retry-After": "60", "X-Request-ID": request.state.request_id},
            )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(
            code=code,
            message=message,
            request_id=getattr(request.state, "request_id", None),
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else "The request could not be completed."
    code = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        413: "upload_too_large",
        415: "unsupported_media_type",
        429: "rate_limit_exceeded",
        503: "service_unavailable",
    }.get(exc.status_code, "request_failed")
    return _error_response(
        request,
        status_code=exc.status_code,
        code=code,
        message=message,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return _error_response(
        request,
        status_code=422,
        code="validation_error",
        message="Request fields are invalid. Check the API schema and try again.",
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_request_error",
        extra={"request_id": getattr(request.state, "request_id", None)},
    )
    return _error_response(
        request,
        status_code=500,
        code="internal_error",
        message="The server could not complete this request.",
    )


def _get_state(request: Request, key: str) -> Any:
    value = getattr(request.app.state, key, None)
    if value is None:
        raise HTTPException(status_code=503, detail=f"{key} is not initialized.")
    return value


def _job_response(job: VideoJob) -> VideoJobResponse:
    return VideoJobResponse(
        job_id=job.job_id,
        inspection_id=job.inspection_id,
        status=job.status,
        progress=job.progress,
        frames_processed=job.frames_processed,
        total_frames=job.total_frames,
        error=job.error,
        result_url=f"/api/jobs/{job.job_id}/result" if job.status == "completed" else None,
    )


async def _save_inspection_if_available(
    *,
    request: Request,
    principal: Principal,
    inspection_id: str,
    source: str,
    detections: list[Any],
    safety_assessment: Any,
    model_version: str,
    evidence_bytes: bytes | None,
    evidence_content_type: str,
    evidence_suffix: str,
) -> bool:
    store: InspectionStore = _get_state(request, "store")
    settings: Settings = _get_state(request, "settings")
    storage: EvidenceStorage | None = getattr(request.app.state, "storage", None)
    evidence_reference = None
    if storage is not None and evidence_bytes is not None:
        evidence_reference = await asyncio.to_thread(
            storage.put,
            evidence_bytes,
            content_type=evidence_content_type,
            suffix=evidence_suffix,
        )
    document = {
        "inspection_id": inspection_id,
        "user_id": principal.user_id,
        "workplace_id": principal.workplace_id,
        "source": source,
        "created_at": datetime.now(timezone.utc),
        "model_version": model_version,
        "detections": [item.model_dump(mode="json") for item in detections],
        "detection_summary": _summarize_detections(detections),
        "safety_assessment": safety_assessment.model_dump(mode="json"),
        "review_status": "requires_review",
        "evidence_reference": evidence_reference,
    }
    try:
        await asyncio.to_thread(store.save, document)
        return True
    except RuntimeError as exc:
        if settings.mongodb_uri:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        logger.info("inspection_history_not_configured", extra={"source": source})
        return False
    except Exception as exc:
        logger.exception("inspection_history_save_failed")
        raise HTTPException(status_code=503, detail="Inspection history could not be saved.") from exc


def _summarize_detections(detections: list[Any]) -> list[dict[str, int | float | str]]:
    aggregates: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"class_name": "", "count": 0, "confidence_sum": 0.0}
    )
    for detection in detections:
        item = aggregates[detection.class_id]
        item["class_name"] = detection.class_name
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


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/healthz", response_model=HealthResponse, tags=["health"], include_in_schema=False)
async def health(request: Request) -> HealthResponse:
    detector: DetectionEngine = _get_state(request, "detector")
    store: InspectionStore = _get_state(request, "store")
    settings: Settings = _get_state(request, "settings")
    return HealthResponse(
        status="ok" if detector.is_loaded else "degraded",
        model_loaded=detector.is_loaded,
        model_version=detector.model_version if detector.is_loaded else None,
        model_error=detector.error,
        database_connected=store.is_connected,
        auth_mode=settings.auth_mode,
    )


@app.post(
    "/api/detect/image",
    response_model=ImageDetectionResponse,
    tags=["detection"],
    responses={400: {}, 413: {}, 415: {}, 503: {}},
)
async def detect_image(
    request: Request,
    file: UploadFile = File(...),
    confidence: float | None = Query(default=None, ge=0.05, le=0.95),
    store_history: bool = Query(default=True),
    principal: Principal = Depends(get_request_principal),
) -> ImageDetectionResponse:
    settings: Settings = _get_state(request, "settings")
    payload = await read_upload_limited(
        file,
        max_bytes=settings.max_image_bytes,
        request=request,
    )
    image_rgb = decode_and_validate_image(payload, file.content_type, settings)
    detector: DetectionEngine = _get_state(request, "detector")
    if not detector.is_loaded:
        raise HTTPException(
            status_code=503,
            detail=detector.error or "The trained detection model is unavailable.",
        )
    prediction = await asyncio.to_thread(detector.predict, image_rgb, confidence)
    assessment = assess_safety(
        list(detector.class_names.values()),
        prediction.detections,
    )
    annotated_data_url = encode_annotated_image(prediction.annotated)
    annotated_bytes = base64.b64decode(annotated_data_url.split(",", maxsplit=1)[1])
    inspection_id = str(uuid.uuid4())
    history_stored = False
    if store_history:
        history_stored = await _save_inspection_if_available(
            request=request,
            principal=principal,
            inspection_id=inspection_id,
            source="image",
            detections=prediction.detections,
            safety_assessment=assessment,
            model_version=detector.model_version or "unversioned",
            evidence_bytes=annotated_bytes,
            evidence_content_type="image/jpeg",
            evidence_suffix="jpg",
        )
    return ImageDetectionResponse(
        inspection_id=inspection_id,
        detections=prediction.detections,
        total_objects=len(prediction.detections),
        safety_assessment=assessment,
        annotated_image=annotated_data_url,
        model_version=detector.model_version or "unversioned",
        history_stored=history_stored,
        created_at=datetime.now(timezone.utc),
    )


@app.post(
    "/api/detect/video",
    response_model=VideoJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["detection"],
    responses={400: {}, 413: {}, 415: {}, 503: {}},
)
async def detect_video(
    request: Request,
    file: UploadFile = File(...),
    confidence: float | None = Query(default=None, ge=0.05, le=0.95),
    store_history: bool = Query(default=True),
    principal: Principal = Depends(get_request_principal),
) -> VideoJobResponse:
    settings: Settings = _get_state(request, "settings")
    detector: DetectionEngine = _get_state(request, "detector")
    if not detector.is_loaded:
        raise HTTPException(
            status_code=503,
            detail=detector.error or "The trained detection model is unavailable.",
        )
    if file.content_type != "video/mp4":
        raise HTTPException(status_code=415, detail="Only MP4 video uploads (video/mp4) are supported.")

    input_path = await save_upload_to_temp(
        file,
        max_bytes=settings.max_video_bytes,
        request=request,
    )
    try:
        metadata = inspect_video(input_path, file.content_type, settings)
        manager: VideoJobManager = _get_state(request, "video_jobs")
        job = manager.start(
            input_path=input_path,
            metadata=metadata,
            user_id=principal.user_id,
            workplace_id=principal.workplace_id,
            confidence=confidence or settings.confidence_threshold,
            store_history=store_history,
        )
        return _job_response(job)
    except Exception:
        input_path.unlink(missing_ok=True)
        raise


@app.get("/api/jobs/{job_id}", response_model=VideoJobResponse, tags=["detection"])
async def get_video_job(
    request: Request,
    job_id: str,
    principal: Principal = Depends(get_request_principal),
) -> VideoJobResponse:
    manager: VideoJobManager = _get_state(request, "video_jobs")
    job = manager.get_for_owner(
        job_id,
        user_id=principal.user_id,
        workplace_id=principal.workplace_id,
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Video job was not found.")
    return _job_response(job)


@app.get("/api/jobs/{job_id}/result", tags=["detection"])
async def get_video_result(
    request: Request,
    job_id: str,
    principal: Principal = Depends(get_request_principal),
):
    manager: VideoJobManager = _get_state(request, "video_jobs")
    job = manager.get_for_owner(
        job_id,
        user_id=principal.user_id,
        workplace_id=principal.workplace_id,
    )
    if job is None or job.status != "completed" or job.result_path is None:
        raise HTTPException(status_code=404, detail="Completed video result was not found.")
    return FileResponse(
        job.result_path,
        media_type="video/mp4",
        filename="safesight-annotated.mp4",
    )


@app.get("/api/detections", response_model=InspectionListResponse, tags=["history"])
async def list_detections(
    request: Request,
    limit: int = Query(default=25, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    principal: Principal = Depends(get_request_principal),
) -> InspectionListResponse:
    store: InspectionStore = _get_state(request, "store")
    try:
        documents, total = await asyncio.to_thread(
            store.list_for_owner,
            user_id=principal.user_id,
            workplace_id=principal.workplace_id,
            limit=limit,
            skip=skip,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return InspectionListResponse(
        items=[InspectionResponse.model_validate(document) for document in documents],
        limit=limit,
        skip=skip,
        total=total,
    )


@app.get(
    "/api/detections/{inspection_id}",
    response_model=InspectionResponse,
    tags=["history"],
)
async def get_detection(
    request: Request,
    inspection_id: str,
    principal: Principal = Depends(get_request_principal),
) -> InspectionResponse:
    store: InspectionStore = _get_state(request, "store")
    try:
        document = await asyncio.to_thread(
            store.get_for_owner,
            inspection_id=inspection_id,
            user_id=principal.user_id,
            workplace_id=principal.workplace_id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Inspection was not found.")
    return InspectionResponse.model_validate(document)
