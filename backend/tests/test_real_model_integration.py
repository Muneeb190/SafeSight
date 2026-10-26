from __future__ import annotations

import os
from pathlib import Path

import pytest
from PIL import Image

from app.config import Settings
from app.detector import DetectionEngine


@pytest.mark.integration
def test_real_checkpoint_runs_on_real_sample_image():
    """Runs only when licensed project weights and a representative sample exist."""
    model_path = Path(os.getenv("MODEL_PATH", "models/best.pt"))
    sample_path = Path(os.getenv("SAMPLE_IMAGE_PATH", "tests/assets/safety-sample.jpg"))
    if not model_path.is_file() or not sample_path.is_file():
        pytest.skip("Provide models/best.pt and tests/assets/safety-sample.jpg to run model integration.")

    engine = DetectionEngine(
        Settings(
            model_path=model_path,
            dataset_yaml=Path(os.getenv("DATASET_YAML")) if os.getenv("DATASET_YAML") else None,
        )
    )
    engine.load()
    assert engine.is_loaded, engine.error
    with Image.open(sample_path) as image:
        result = engine.predict(__import__("numpy").asarray(image.convert("RGB")))
    assert isinstance(result.detections, list)
    assert result.annotated.size > 0
