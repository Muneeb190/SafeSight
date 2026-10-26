from __future__ import annotations

import os
import tempfile

import pytest

from app import main
from app.detector import DetectionEngine
from app.services import uploads


def test_health_reports_missing_model(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is False
    assert response.json()["status"] == "degraded"
    assert "weights" in response.json()["model_error"].lower()


def test_valid_image_returns_detection_schema(client, fake_detector, valid_jpeg):
    client.app.state.detector = fake_detector
    response = client.post(
        "/api/detect/image",
        files={"file": ("safety.jpg", valid_jpeg, "image/jpeg")},
        params={"store_history": "false"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_objects"] == 1
    assert body["detections"][0] == {
        "class_id": 1,
        "class_name": "no helmet",
        "confidence": 0.91,
        "box": [1.0, 2.0, 10.0, 20.0],
    }
    assert body["safety_assessment"]["status"] == "potential_violation"
    assert body["safety_assessment"]["requires_human_review"] is True
    assert body["history_stored"] is False
    assert body["annotated_image"].startswith("data:image/jpeg;base64,")
    assert body["model_version"] == "test-model"


def test_invalid_image_content_is_rejected(client):
    response = client.post(
        "/api/detect/image",
        files={"file": ("not-image.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"


def test_mismatched_image_mime_is_rejected(client, valid_jpeg):
    response = client.post(
        "/api/detect/image",
        files={"file": ("renamed.png", valid_jpeg, "image/png")},
    )
    assert response.status_code == 415
    assert "does not match" in response.json()["error"]["message"]


def test_unsupported_upload_mime_is_rejected(client):
    response = client.post(
        "/api/detect/image",
        files={"file": ("payload.gif", b"GIF89a", "image/gif")},
    )
    assert response.status_code == 415


def test_oversized_image_is_rejected(client, valid_jpeg):
    client.app.state.settings.max_image_bytes = len(valid_jpeg) - 1
    response = client.post(
        "/api/detect/image",
        files={"file": ("worker.jpg", valid_jpeg, "image/jpeg")},
    )
    assert response.status_code == 413


def test_valid_image_without_model_returns_actionable_error(client, valid_jpeg):
    response = client.post(
        "/api/detect/image",
        files={"file": ("worker.jpg", valid_jpeg, "image/jpeg")},
    )
    assert response.status_code == 503
    assert "weights" in response.json()["error"]["message"].lower()


def test_history_is_unavailable_without_database(client):
    response = client.get("/api/detections")
    assert response.status_code == 503
    assert "MongoDB" in response.json()["error"]["message"]


def test_video_validation_failure_removes_temporary_file(
    client,
    fake_detector,
    monkeypatch: pytest.MonkeyPatch,
):
    client.app.state.detector = fake_detector
    created: list[str] = []
    original_mkstemp = tempfile.mkstemp

    def tracked_mkstemp(*args, **kwargs):
        descriptor, path = original_mkstemp(*args, **kwargs)
        created.append(path)
        return descriptor, path

    monkeypatch.setattr(uploads.tempfile, "mkstemp", tracked_mkstemp)
    response = client.post(
        "/api/detect/video",
        files={"file": ("invalid.mp4", b"not an mp4 file", "video/mp4")},
    )
    assert response.status_code == 415
    assert created
    assert all(not os.path.exists(path) for path in created)


def test_detection_model_missing_file_has_clear_error(tmp_path):
    from app.config import Settings

    engine = DetectionEngine(Settings(model_path=tmp_path / "missing.pt"))
    engine.load()
    assert engine.is_loaded is False
    assert "Place the fine-tuned YOLO weights there" in (engine.error or "")


def test_safety_rules_do_not_treat_equipment_as_compliance():
    from app.safety_rules import assess_safety

    assessment = assess_safety(["person", "helmet", "safety vest"], [])
    assert assessment.status == "unsupported"
    assert assessment.requires_human_review is True
    assert assessment.violations == []


def test_safety_rule_requires_review_for_explicit_missing_ppe_label():
    from app.safety_rules import assess_safety
    from app.schemas import Detection

    assessment = assess_safety(
        ["person", "no_helmet"],
        [Detection(class_id=1, class_name="no_helmet", confidence=0.8, box=[0, 0, 1, 1])],
    )
    assert assessment.status == "potential_violation"
    assert assessment.requires_human_review is True
