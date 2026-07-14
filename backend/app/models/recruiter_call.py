"""
SQLAlchemy models for Recruiter Outbound Calls and Streaming Messages.
Enforces multi-tenant RLS isolation keys.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import ForeignKey, String, Text, text, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class RecruiterCall(Base, TenantMixin, TimestampMixin):
    """
    Simulated outbound recruiting calls logs.
    """
    __tablename__ = "recruiter_calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Status: DIALING | CONNECTED | DISCONNECTED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="DIALING")

    call_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    messages: Mapped[List["CallMessage"]] = relationship(
        "CallMessage", back_populates="call", cascade="all, delete-orphan", order_by="CallMessage.created_at"
    )


class CallMessage(Base, TenantMixin):
    """
    Streaming conversation exchanges recorded during outbound recruiting calls.
    """
    __tablename__ = "call_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    call_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recruiter_calls.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Sender: AGENT | CANDIDATE
    sender: Mapped[str] = mapped_column(String(50), nullable=False)

    message_text: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), default=datetime.utcnow, nullable=False
    )

    call: Mapped["RecruiterCall"] = relationship("RecruiterCall", back_populates="messages")
