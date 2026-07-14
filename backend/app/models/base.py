"""
Base SQLAlchemy model mixin.
All tenant-scoped models inherit TenantMixin to enforce tenant_id.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class TimestampMixin:
    """Adds created_at and updated_at to a model."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=text("now()"),
        nullable=False,
    )


class TenantMixin:
    """
    MANDATORY mixin for all business entity models.
    Enforces tenant_id is always present and links to tenants.id.
    PostgreSQL RLS policies use this column.
    """
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant isolation column. RLS policies filter on this.",
    )
