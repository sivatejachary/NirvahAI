"""
Application Configuration
Loaded from environment variables using pydantic-settings.
"""
import json
from functools import lru_cache
from typing import Any, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "change-me-in-production"
    APP_DEBUG: bool = True
    ALLOWED_ORIGINS: Any = None

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> List[str]:
        """
        Accept ALLOWED_ORIGINS as:
          - None / empty string  → use built-in defaults
          - JSON array string    → '["http://...","http://..."]'
          - Comma-separated str  → 'http://...,http://...'
          - Already a list       → pass through
        """
        _defaults = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://192.168.1.28:3000",
            "http://192.168.1.28:3001",
            "https://vidyamarg-ai.vercel.app",
            "https://nirvah-ai-ruby.vercel.app",
            "https://nirvahai-production.up.railway.app",
        ]
        if v is None or v == "":
            return _defaults
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return _defaults
            # Try JSON array first
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            # Fall back to comma-separated
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return _defaults

    # ── PostgreSQL ────────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "hros"
    POSTGRES_USER: str = "hros"
    POSTGRES_PASSWORD: str = "hros_dev_password"
    DATABASE_URL: str = "postgresql+asyncpg://hros:hros_dev_password@localhost:5432/hros"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def parse_database_url(cls, v: Any) -> str:
        """
        Coerces postgresql:// or postgres:// database URLs to use postgresql+asyncpg://
        and prefers DATABASE_PRIVATE_URL or POSTGRES_PRIVATE_URL if set.
        """
        import os
        private_url = os.environ.get("DATABASE_PRIVATE_URL") or os.environ.get("POSTGRES_PRIVATE_URL")
        url = private_url or v

        if not url or not isinstance(url, str):
            return url

        url = url.strip()
        # Ensure asyncpg is specified for postgresql/postgres URLs
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        return url

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def parse_redis_url(cls, v: Any) -> str:
        """
        Prefers REDIS_PRIVATE_URL if set in the environment.
        """
        import os
        private_url = os.environ.get("REDIS_PRIVATE_URL")
        url = private_url or v
        return url.strip() if isinstance(url, str) else url

    # ── Qdrant ───────────────────────────────────────────────────────────────
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_API_KEY: str = ""

    # ── MinIO / S3 ────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minio_access_key"
    MINIO_SECRET_KEY: str = "minio_secret_key"
    MINIO_BUCKET: str = "hros"
    MINIO_USE_SSL: bool = False
    STORAGE_URL_EXPIRY_SECONDS: int = 900

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Temporal ─────────────────────────────────────────────────────────────
    TEMPORAL_HOST: str = "localhost"
    TEMPORAL_PORT: int = 7233
    TEMPORAL_NAMESPACE: str = "hros-dev"

    # ── AI Model Gateway ──────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DEFAULT_LLM_PROVIDER: str = "gemini"
    DEFAULT_LLM_MODEL: str = "gemini-1.5-flash"

    # ── Observability ─────────────────────────────────────────────────────────
    OTEL_SERVICE_NAME: str = "hros-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    LOG_LEVEL: str = "INFO"

    # ── Email ─────────────────────────────────────────────────────────────────
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@hros.local"

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    PUBLIC_RATE_LIMIT_PER_MINUTE: int = 20

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
