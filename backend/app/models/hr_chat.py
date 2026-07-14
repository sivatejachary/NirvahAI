"""
Employee HR Chat / Self Service Chatbot Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class HRChatSession(Base, TenantMixin, TimestampMixin):
    """HR self-service chat sessions with employees."""
    __tablename__ = "hr_chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(320), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="CHAT")  # CHAT | VOICE
    topic: Mapped[Optional[str]] = mapped_column(String(255))
    messages: Mapped[dict] = mapped_column(JSONB, default=list, server_default=text("'[]'"))  # [{role, content, timestamp}]
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="OPEN")  # OPEN | RESOLVED
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
