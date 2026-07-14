"""
Meeting & Transcription Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class Meeting(Base, TenantMixin, TimestampMixin):
    """Meetings processed by Meeting Intelligence."""
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    attendees: Mapped[dict] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))  # list of email strings
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    action_items: Mapped[dict] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))  # [{item, owner, due}]
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING_SUMMARY")  # PENDING_SUMMARY | SUMMARIZED
