from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import get_optional_principal
from app.config import Settings
from app.database import InspectionStore


class FakeSigningKey:
    def __init__(self, key):
        self.key = key


class FakeJwksClient:
    def __init__(self, signing_key):
        self.signing_key = signing_key

    def get_signing_key_from_jwt(self, token: str):
        del token
        return FakeSigningKey(self.signing_key)


def issue_token(private_key, *, issuer: str, include_workplace: bool = True) -> str:
    claims = {
        "sub": "user-42",
        "iss": issuer,
        "aud": "safesight-api",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    if include_workplace:
        claims["workplace_id"] = "site-8"
    return jwt.encode(claims, private_key, algorithm="RS256")


def test_valid_bearer_token_produces_user_and_workplace_principal(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = Settings(
        auth_mode="required",
        auth_issuer="https://identity.example",
        auth_jwks_url="https://identity.example/.well-known/jwks.json",
        auth_audience="safesight-api",
    )
    monkeypatch.setattr(
        "app.auth._jwks_client",
        lambda _url: FakeJwksClient(private_key.public_key()),
    )
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials=issue_token(private_key, issuer="https://identity.example"),
    )

    principal = asyncio.run(get_optional_principal(credentials, settings))
    assert principal.user_id == "user-42"
    assert principal.workplace_id == "site-8"


def test_wrong_issuer_is_rejected(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = Settings(
        auth_mode="required",
        auth_issuer="https://trusted.example",
        auth_jwks_url="https://trusted.example/.well-known/jwks.json",
        auth_audience="safesight-api",
    )
    from app import auth

    monkeypatch.setattr(
        auth,
        "_jwks_client",
        lambda _url: FakeJwksClient(private_key.public_key()),
    )
    token = issue_token(private_key, issuer="https://untrusted.example")
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            get_optional_principal(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
                settings,
            )
        )
    assert error.value.status_code == 401


def test_token_without_workplace_claim_is_forbidden(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = Settings(
        auth_mode="required",
        auth_issuer="https://identity.example",
        auth_jwks_url="https://identity.example/.well-known/jwks.json",
        auth_audience="safesight-api",
    )
    monkeypatch.setattr(
        "app.auth._jwks_client",
        lambda _url: FakeJwksClient(private_key.public_key()),
    )
    token = issue_token(private_key, issuer="https://identity.example", include_workplace=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            get_optional_principal(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
                settings,
            )
        )
    assert error.value.status_code == 403


def test_inspection_query_is_scoped_by_both_user_and_workplace():
    class RecordingCollection:
        query = None

        def find_one(self, query, projection):
            self.query = query
            return None

    store = InspectionStore(Settings())
    store.collection = RecordingCollection()
    store.get_for_owner(
        inspection_id="inspection-1",
        user_id="user-42",
        workplace_id="site-8",
    )
    assert store.collection.query == {
        "inspection_id": "inspection-1",
        "user_id": "user-42",
        "workplace_id": "site-8",
    }
