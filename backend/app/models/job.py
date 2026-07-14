"""
Job Postings & Recruitment Models
Tracks job descriptions, approvals, and multi-channel sourcing distributions.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class Job(Base, TenantMixin, TimestampMixin):
    """
    Job Posting entity.
    Generates and tracks compliant JD details and channel sourcing states.
    """
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[Optional[list]] = mapped_column(JSONB, default=list) # e.g. ["Python", "5 years experience"]
    
    # Status: DRAFT | UNDER_REVIEW | APPROVED | PUBLISHED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="DRAFT")
    
    # Channels distribution logs: {"linkedin": "published", "indeed": "pending"}
    sourcing_channels: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
