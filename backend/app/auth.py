from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: str
    workplace_id: str


@lru_cache(maxsize=8)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=300)


def principal_from_claims(claims: dict[str, Any], settings: Settings) -> Principal:
    user_id = claims.get("sub")
    workplace_id = claims.get(settings.auth_workplace_claim)
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="The access token has no user subject.")
    if not isinstance(workplace_id, str) or not workplace_id:
        raise HTTPException(
            status_code=403,
            detail=(
                f"The access token must include a string '{settings.auth_workplace_claim}' claim "
                "to scope safety inspection records."
            ),
        )
    return Principal(user_id=user_id, workplace_id=workplace_id)


async def get_optional_principal(
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> Principal:
    if credentials is None:
        if settings.auth_mode == "required":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A valid bearer access token is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return Principal(
            user_id="local-development-user",
            workplace_id="local-development-workplace",
        )

    if not settings.auth_issuer or not settings.auth_jwks_url:
        raise HTTPException(
            status_code=503,
            detail="Bearer-token verification is not configured. Set AUTH_ISSUER and AUTH_JWKS_URL.",
        )
    token = credentials.credentials
    try:
        key = _jwks_client(settings.auth_jwks_url).get_signing_key_from_jwt(token)
        options = {"verify_aud": bool(settings.auth_audience)}
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=settings.auth_issuer,
            audience=settings.auth_audience,
            options=options,
        )
        return principal_from_claims(claims, settings)
    except HTTPException:
        raise
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        logger.info("bearer_token_rejected", extra={"reason": type(exc).__name__})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The bearer access token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_request_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    return await get_optional_principal(credentials, request.app.state.settings)
