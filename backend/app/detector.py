from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml

from app.config import Settings
from app.schemas import Detection

logger = logging.getLogger(__name__)


@dataclass
class Prediction:
    detections: list[Detection]
    annotated: np.ndarray


class DetectionEngine:
    """Loads one YOLO model for the process and reuses it across requests."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any | None = None
        self.class_names: dict[int, str] = {}
        self.model_version: str | None = settings.model_version
        self.error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        model_path = self.settings.model_path
        if not model_path.is_file():
            self.error = (
                f"Trained model weights were not found at {model_path}. "
                "Place the fine-tuned YOLO weights there or set MODEL_PATH."
            )
            logger.warning("model_unavailable", extra={"reason": self.error})
            return

        try:
            from ultralytics import YOLO

            model = YOLO(str(model_path))
            model_names = self._normalize_names(model.names)
            dataset_names = self._load_dataset_names()
            if dataset_names is not None and dataset_names != model_names:
                raise ValueError(
                    "Dataset YAML class IDs/names do not match the class names embedded in the trained model."
                )
            self.model = model
            self.class_names = dataset_names or model_names
            self.model_version = self.settings.model_version or self._sha256(model_path)
            self.error = None
            logger.info(
                "model_loaded",
                extra={
                    "model_version": self.model_version,
                    "class_count": len(self.class_names),
                    "device": self.settings.model_device,
                },
            )
        except Exception as exc:
            self.model = None
            self.class_names = {}
            if isinstance(exc, ImportError):
                self.error = (
                    "The Ultralytics runtime is not installed. Install the project dependencies "
                    "from requirements.txt, then restart the API."
                )
            else:
                self.error = (
                    f"Could not load the YOLO model from {model_path}: {type(exc).__name__}: {exc}. "
                    "Check that the file is a valid, compatible Ultralytics checkpoint."
                )
            logger.exception("model_load_failed")

    def _load_dataset_names(self) -> dict[int, str] | None:
        yaml_path: Path | None = self.settings.dataset_yaml
        if yaml_path is None:
            return None
        if not yaml_path.is_file():
            raise FileNotFoundError(f"Dataset YAML was configured but not found: {yaml_path}")
        with yaml_path.open("r", encoding="utf-8") as handle:
            document = yaml.safe_load(handle) or {}
        names = document.get("names")
        if isinstance(names, list):
            return {index: str(name) for index, name in enumerate(names)}
        if isinstance(names, dict):
            return {int(class_id): str(name) for class_id, name in names.items()}
        raise ValueError("Dataset YAML must contain a 'names' list or class-ID mapping.")

    @staticmethod
    def _normalize_names(names: Any) -> dict[int, str]:
        if isinstance(names, list):
            return {index: str(name) for index, name in enumerate(names)}
        if isinstance(names, dict):
            return {int(class_id): str(name) for class_id, name in names.items()}
        raise ValueError("Model checkpoint does not expose a valid class-name mapping.")

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return f"sha256:{digest.hexdigest()}"

    def predict(self, image_rgb: np.ndarray, confidence: float | None = None) -> Prediction:
        if self.model is None:
            raise RuntimeError(self.error or "Detection model is not loaded.")

        results = self.model.predict(
            source=image_rgb,
            conf=confidence or self.settings.confidence_threshold,
            imgsz=self.settings.model_imgsz,
            device=self.settings.model_device,
            verbose=False,
        )
        result = results[0]
        boxes = result.boxes
        detections: list[Detection] = []
        if boxes is not None:
            coordinates = boxes.xyxy.cpu().tolist()
            class_ids = boxes.cls.cpu().tolist()
            confidences = boxes.conf.cpu().tolist()
            for coordinates_row, raw_class_id, raw_confidence in zip(
                coordinates, class_ids, confidences, strict=False
            ):
                class_id = int(raw_class_id)
                class_name = self.class_names.get(class_id)
                if class_name is None:
                    # Unknown class IDs are surfaced rather than relabeled.
                    class_name = f"unknown-class-{class_id}"
                detections.append(
                    Detection(
                        class_id=class_id,
                        class_name=class_name,
                        confidence=float(raw_confidence),
                        box=[float(value) for value in coordinates_row],
                    )
                )
        return Prediction(detections=detections, annotated=result.plot())


def encode_annotated_image(image_bgr: np.ndarray) -> str:
    success, encoded = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise RuntimeError("OpenCV could not encode the annotated image.")
    import base64

    return "data:image/jpeg;base64," + base64.b64encode(encoded.tobytes()).decode("ascii")
