"""
JWT Token Management
Access tokens (short-lived) and refresh tokens (long-lived).
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
import bcrypt
import hashlib
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    tenant_id: str,
    user_id: str,
    roles: list[str],
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "tid": str(tenant_id),   # tenant_id claim
        "uid": str(user_id),     # user_id claim
        "roles": roles,
        "type": "access",
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    tenant_id: str,
    user_id: str,
) -> str:
    """Create a long-lived JWT refresh token."""
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "tid": str(tenant_id),
        "uid": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.
    Raises JWTError if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.warning("JWT decode failed", error=str(e))
        raise
