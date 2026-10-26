from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "test", "production"] = "development"
    model_path: Path = Path("models/best.pt")
    dataset_yaml: Path | None = None
    model_device: str = "cpu"
    model_imgsz: int = Field(default=640, ge=320, le=2048)
    model_version: str | None = None
    confidence_threshold: float = Field(default=0.25, ge=0.05, le=0.95)
    require_model: bool = False

    max_image_bytes: int = Field(default=10 * 1024 * 1024, ge=1024)
    max_image_width: int = Field(default=8192, ge=1)
    max_image_height: int = Field(default=8192, ge=1)
    max_image_pixels: int = Field(default=32_000_000, ge=1)
    max_video_bytes: int = Field(default=200 * 1024 * 1024, ge=1024)
    max_video_duration_seconds: int = Field(default=180, ge=1)
    max_video_width: int = Field(default=3840, ge=1)
    max_video_height: int = Field(default=2160, ge=1)
    max_video_frames: int = Field(default=10_800, ge=1)
    video_frame_stride: int = Field(default=5, ge=1, le=120)
    video_workers: int = Field(default=1, ge=1, le=4)
    job_retention_seconds: int = Field(default=3600, ge=60)

    mongodb_uri: str | None = None
    mongodb_database: str = "safesight"
    require_database: bool = False

    auth_mode: Literal["disabled", "required"] = "disabled"
    auth_issuer: str | None = None
    auth_jwks_url: str | None = None
    auth_audience: str | None = None
    auth_workplace_claim: str = "workplace_id"

    cors_origins: str = ""
    rate_limit_per_minute: int = Field(default=60, ge=1, le=1000)
    s3_bucket: str | None = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_prefix: str = "safesight/evidence"

    @field_validator("confidence_threshold")
    @classmethod
    def confidence_in_safe_range(cls, value: float) -> float:
        if not 0.05 <= value <= 0.95:
            raise ValueError("confidence threshold must be between 0.05 and 0.95")
        return value

    @field_validator("cors_origins")
    @classmethod
    def trim_origins(cls, value: str) -> str:
        return ",".join(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())

    @model_validator(mode="after")
    def require_production_services(self) -> "Settings":
        if self.app_env == "production":
            self.require_model = True
            self.require_database = True
            self.auth_mode = "required"
        if self.auth_mode == "required" and (not self.auth_issuer or not self.auth_jwks_url):
            if self.app_env == "production":
                raise ValueError(
                    "AUTH_ISSUER and AUTH_JWKS_URL are required when authentication is enabled"
                )
        return self

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin for origin in self.cors_origins.split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()
