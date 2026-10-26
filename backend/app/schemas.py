from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class Detection(BaseModel):
    class_id: int = Field(ge=0)
    class_name: str
    confidence: float = Field(ge=0, le=1)
    box: list[float] = Field(min_length=4, max_length=4, description="x1, y1, x2, y2 pixels")


class SafetyAssessment(BaseModel):
    status: Literal[
        "potential_violation",
        "no_supported_violation_detected",
        "unsupported",
    ]
    requires_human_review: bool = True
    rule_version: str
    violations: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class ImageDetectionResponse(BaseModel):
    inspection_id: str
    detections: list[Detection]
    total_objects: int = Field(ge=0)
    safety_assessment: SafetyAssessment
    annotated_image: str
    model_version: str
    history_stored: bool
    created_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_loaded: bool
    model_version: str | None = None
    model_error: str | None = None
    database_connected: bool
    auth_mode: str


class VideoJobResponse(BaseModel):
    job_id: str
    inspection_id: str
    status: Literal["queued", "processing", "completed", "failed"]
    progress: float = Field(ge=0, le=100)
    frames_processed: int = Field(ge=0)
    total_frames: int = Field(ge=0)
    error: str | None = None
    result_url: str | None = None


class InspectionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    inspection_id: str
    source: Literal["image", "video", "manual_upload"]
    created_at: datetime
    model_version: str
    detections: list[Detection]
    detection_summary: list[dict[str, int | float | str]] = Field(default_factory=list)
    safety_assessment: SafetyAssessment
    review_status: Literal["requires_review", "reviewed", "not_applicable"]
    evidence_reference: str | None = None


class InspectionListResponse(BaseModel):
    items: list[InspectionResponse]
    limit: int
    skip: int
    total: int
