from __future__ import annotations

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.detector import DetectionEngine, Prediction
from app.main import app
from app.config import get_settings
from app.schemas import Detection


class FakeDetector:
    is_loaded = True
    model_version = "test-model"
    error = None
    class_names = {0: "person", 1: "no helmet"}

    def predict(self, image_rgb: np.ndarray, confidence: float | None = None) -> Prediction:
        del confidence
        return Prediction(
            detections=[
                Detection(
                    class_id=1,
                    class_name="no helmet",
                    confidence=0.91,
                    box=[1, 2, 10, 20],
                )
            ],
            annotated=np.zeros((32, 32, 3), dtype=np.uint8),
        )


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    # Unit tests never load the real model. A separate integration test uses
    # the real weights when the user supplies them.
    monkeypatch.setattr(
        DetectionEngine,
        "load",
        lambda self: setattr(self, "error", "trained model weights are unavailable for this test"),
    )
    get_settings.cache_clear()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        get_settings.cache_clear()


@pytest.fixture
def fake_detector():
    return FakeDetector()


@pytest.fixture
def valid_jpeg() -> bytes:
    image = Image.new("RGB", (32, 32), color=(50, 120, 90))
    output = io.BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()
