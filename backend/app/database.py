from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.config import Settings

logger = logging.getLogger(__name__)


class InspectionStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: MongoClient[dict[str, Any]] | None = None
        self.collection: Collection[dict[str, Any]] | None = None
        self.error: str | None = None

    @property
    def is_connected(self) -> bool:
        return self.collection is not None

    def connect(self) -> None:
        if not self.settings.mongodb_uri:
            self.error = "MongoDB is not configured because MONGODB_URI is missing."
            if self.settings.require_database:
                raise RuntimeError(
                    "MongoDB is required in this environment but MONGODB_URI is not configured."
                )
            return
        try:
            self.client = MongoClient(
                self.settings.mongodb_uri,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                appname="SafeSight-API",
                tz_aware=True,
            )
            self.client.admin.command("ping")
            database = self.client[self.settings.mongodb_database]
            self.collection = database["inspections"]
            self.collection.create_index(
                [("user_id", 1), ("workplace_id", 1), ("created_at", DESCENDING)],
                name="inspection_owner_recent",
            )
            self.collection.create_index(
                [("workplace_id", 1), ("created_at", DESCENDING)],
                name="inspection_workplace_recent",
            )
            self.collection.create_index(
                [("review_status", 1), ("created_at", DESCENDING)],
                name="inspection_review_status",
            )
            self.collection.create_index(
                [("inspection_id", 1)],
                unique=True,
                name="inspection_id_unique",
            )
            self.error = None
            logger.info("mongodb_connected", extra={"database": self.settings.mongodb_database})
        except PyMongoError as exc:
            self.error = f"MongoDB is unavailable: {type(exc).__name__}."
            logger.error(
                "mongodb_connection_failed",
                extra={"error_type": type(exc).__name__},
            )
            self.close()
            if self.settings.require_database:
                raise RuntimeError(
                    "MongoDB is required but the configured database could not be reached. "
                    "Check MONGODB_URI, Atlas network access, and database credentials."
                ) from exc

    def close(self) -> None:
        if self.client is not None:
            self.client.close()
        self.client = None
        self.collection = None

    def save(self, document: dict[str, Any]) -> None:
        collection = self._require_collection()
        payload = dict(document)
        payload["_id"] = payload["inspection_id"]
        payload["created_at"] = payload.get("created_at") or datetime.now(timezone.utc)
        collection.insert_one(payload)

    def list_for_owner(
        self,
        *,
        user_id: str,
        workplace_id: str,
        limit: int,
        skip: int,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self._require_collection()
        query = {"user_id": user_id, "workplace_id": workplace_id}
        total = collection.count_documents(query)
        cursor = (
            collection.find(query, {"_id": 0})
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        return list(cursor), total

    def get_for_owner(
        self, *, inspection_id: str, user_id: str, workplace_id: str
    ) -> dict[str, Any] | None:
        collection = self._require_collection()
        return collection.find_one(
            {
                "inspection_id": inspection_id,
                "user_id": user_id,
                "workplace_id": workplace_id,
            },
            {"_id": 0},
        )

    def _require_collection(self) -> Collection[dict[str, Any]]:
        if self.collection is None:
            raise RuntimeError(
                self.error
                or "Inspection history is unavailable because MongoDB is not configured."
            )
        return self.collection
