"""
SQLAlchemy models for Adaptive Technical Interviews and Chat Dialog Messages.
Enforces multi-tenant RLS isolation keys.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import ForeignKey, String, Text, text, Float
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class Interview(Base, TenantMixin, TimestampMixin):
    """
    Adaptive technical interviews conducted by automated agents.
    """
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Status: SCHEDULED | IN_PROGRESS | COMPLETED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="SCHEDULED")

    # Aggregate performance score given by the evaluator agent
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Custom grading report details: {"skills_score": 75, "communication": "Exemplary", "reasoning": "..."}
    evaluation_report: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Message dialogue relationship
    messages: Mapped[List["InterviewMessage"]] = relationship(
        "InterviewMessage", back_populates="interview", cascade="all, delete-orphan", order_by="InterviewMessage.created_at"
    )


class InterviewMessage(Base, TenantMixin):
    """
    Chronological conversation exchange logged between candidate and adaptive agent.
    """
    __tablename__ = "interview_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Sender: AGENT | CANDIDATE
    sender: Mapped[str] = mapped_column(String(50), nullable=False)

    # Transcript text content
    message_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Path to audio file or recording bucket destination (mocked)
    audio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), default=datetime.utcnow, nullable=False
    )

    interview: Mapped["Interview"] = relationship("Interview", back_populates="messages")
