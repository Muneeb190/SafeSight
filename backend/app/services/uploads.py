from __future__ import annotations

import asyncio
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

import cv2
import numpy as np
from fastapi import HTTPException, Request, UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import Settings

CHUNK_SIZE = 64 * 1024
IMAGE_MIME_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


@dataclass(frozen=True)
class VideoMetadata:
    width: int
    height: int
    fps: float
    frame_count: int
    duration_seconds: float
    codec: str


async def read_upload_limited(
    upload: UploadFile,
    *,
    max_bytes: int,
    request: Request | None = None,
) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        if request is not None and await request.is_disconnected():
            raise HTTPException(status_code=400, detail="The upload was interrupted by the client.")
        chunk = await upload.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=f"Upload exceeds the {max_bytes}-byte limit.")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    return b"".join(chunks)


def decode_and_validate_image(
    payload: bytes,
    claimed_mime: str | None,
    settings: Settings,
) -> np.ndarray:
    if claimed_mime not in IMAGE_MIME_FORMATS:
        raise HTTPException(
            status_code=415,
            detail="Supported image MIME types are image/jpeg, image/png, and image/webp.",
        )
    try:
        with Image.open(__import__("io").BytesIO(payload)) as image:
            actual_format = image.format
            width, height = image.size
            if actual_format != IMAGE_MIME_FORMATS[claimed_mime]:
                raise HTTPException(
                    status_code=415,
                    detail="The uploaded image content does not match its declared MIME type.",
                )
            if width < 1 or height < 1:
                raise HTTPException(status_code=400, detail="Image dimensions are invalid.")
            if width > settings.max_image_width or height > settings.max_image_height:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"Image dimensions exceed the configured limit "
                        f"({settings.max_image_width}x{settings.max_image_height})."
                    ),
                )
            if width * height > settings.max_image_pixels:
                raise HTTPException(
                    status_code=413,
                    detail=f"Image pixel count exceeds the {settings.max_image_pixels}-pixel limit.",
                )
            image.load()
            rgb = np.asarray(image.convert("RGB"))
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.") from exc
    return rgb


async def save_upload_to_temp(
    upload: UploadFile,
    *,
    max_bytes: int,
    request: Request,
) -> Path:
    file_descriptor, raw_path = tempfile.mkstemp(prefix="safesight-upload-", suffix=".mp4")
    path = Path(raw_path)
    total = 0
    try:
        with os.fdopen(file_descriptor, "wb") as destination:
            while True:
                if await request.is_disconnected():
                    raise HTTPException(
                        status_code=400,
                        detail="The upload was interrupted by the client.",
                    )
                chunk = await upload.read(CHUNK_SIZE)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {max_bytes}-byte limit.",
                    )
                destination.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="The uploaded video is empty.")
        return path
    except Exception:
        path.unlink(missing_ok=True)
        raise


def inspect_video(path: Path, claimed_mime: str | None, settings: Settings) -> VideoMetadata:
    if claimed_mime != "video/mp4":
        raise HTTPException(status_code=415, detail="Only MP4 video uploads (video/mp4) are supported.")
    try:
        with path.open("rb") as handle:
            header = handle.read(12)
        if len(header) < 12 or header[4:8] != b"ftyp":
            raise HTTPException(
                status_code=415,
                detail="The uploaded file is not an MP4 container.",
            )
    except OSError as exc:
        raise HTTPException(status_code=400, detail="The uploaded video could not be read.") from exc

    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise HTTPException(
                status_code=415,
                detail="OpenCV could not decode this MP4. Check that it uses a supported video codec.",
            )
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        fourcc_value = int(capture.get(cv2.CAP_PROP_FOURCC))
        codec = "".join(
            character
            for character in fourcc_value.to_bytes(4, "little", signed=False).decode(
                "latin-1", errors="ignore"
            )
            if character.isprintable()
        ).lower()
        if width <= 0 or height <= 0 or fps <= 0 or frame_count <= 0:
            raise HTTPException(
                status_code=415,
                detail="The video has invalid or unsupported dimensions, frame rate, or frame count.",
            )
        if codec not in {"avc1", "h264", "mp4v"}:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported MP4 video codec '{codec or 'unknown'}'. Supported codecs: H.264/avc1 and MPEG-4/mp4v.",
            )
        duration = frame_count / fps
        if width > settings.max_video_width or height > settings.max_video_height:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Video resolution exceeds the configured limit "
                    f"({settings.max_video_width}x{settings.max_video_height})."
                ),
            )
        if frame_count > settings.max_video_frames:
            raise HTTPException(
                status_code=413,
                detail=f"Video exceeds the {settings.max_video_frames}-frame limit.",
            )
        if duration > settings.max_video_duration_seconds:
            raise HTTPException(
                status_code=413,
                detail=(
                    "Video duration exceeds the configured "
                    f"{settings.max_video_duration_seconds}-second limit."
                ),
            )
        readable, _frame = capture.read()
        if not readable:
            raise HTTPException(status_code=415, detail="The MP4 contains no decodable video frames.")
        return VideoMetadata(
            width=width,
            height=height,
            fps=fps,
            frame_count=frame_count,
            duration_seconds=duration,
            codec=codec,
        )
    finally:
        capture.release()
