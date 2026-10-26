from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import boto3

from app.config import Settings

logger = logging.getLogger(__name__)


class EvidenceStorage(Protocol):
    def put(self, data: bytes, *, content_type: str, suffix: str) -> str: ...
    def put_file(self, path: Path, *, content_type: str, suffix: str) -> str: ...


@dataclass
class S3EvidenceStorage:
    bucket: str
    region: str
    prefix: str
    endpoint_url: str | None = None

    def put(self, data: bytes, *, content_type: str, suffix: str) -> str:
        key = f"{self.prefix.strip('/')}/{uuid.uuid4().hex}.{suffix.lstrip('.')}"
        client = self._client()
        client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
        # The key is a private storage reference, not a publicly accessible URL.
        return f"s3://{self.bucket}/{key}"

    def put_file(self, path: Path, *, content_type: str, suffix: str) -> str:
        key = f"{self.prefix.strip('/')}/{uuid.uuid4().hex}.{suffix.lstrip('.')}"
        self._client().upload_file(
            str(path),
            self.bucket,
            key,
            ExtraArgs={
                "ContentType": content_type,
                "ServerSideEncryption": "AES256",
            },
        )
        return f"s3://{self.bucket}/{key}"

    def _client(self):
        return boto3.client(
            "s3",
            region_name=self.region,
            endpoint_url=self.endpoint_url,
        )


def create_storage(settings: Settings) -> EvidenceStorage | None:
    if not settings.s3_bucket:
        return None
    return S3EvidenceStorage(
        bucket=settings.s3_bucket,
        region=settings.s3_region,
        prefix=settings.s3_prefix,
        endpoint_url=settings.s3_endpoint_url,
    )
