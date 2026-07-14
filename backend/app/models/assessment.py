"""
SQLAlchemy models for Assessment attempts, Proctoring logs, and MCQ question banks.
Enforces multi-tenant isolation and proctor anti-cheat indexes.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import Boolean, ForeignKey, String, Text, text, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin, utcnow


class JobMCQ(Base, TenantMixin, TimestampMixin):
    """
    Question bank of Multiple Choice Questions pre-generated or configured per-job.
    """
    __tablename__ = "job_mcqs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # JSON list of choice options e.g. ["A. Option 1", "B. Option 2", ...]
    options: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    
    # Correct answer identifier e.g. "A" or "A. Option 1"
    correct_option: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Difficulty scale: JUNIOR | MID | SENIOR | LEAD
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="MID")


class AssessmentAttempt(Base, TenantMixin, TimestampMixin):
    """
    Logs active candidate proctored test attempts.
    """
    __tablename__ = "assessment_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Type: MCQ | CODING | VOICE_AGENT
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="MCQ")
    
    # Score achieved out of 100
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Status of attempt: STARTED | COMPLETED | EXPIRED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="STARTED")
    
    # Proctor integrity assessment: LOW | MEDIUM | HIGH
    integrity_risk: Mapped[str] = mapped_column(String(50), nullable=False, default="LOW")
    
    # Detailed answers mapping (candidate choice history or response inputs)
    # format: {question_id: candidate_submitted_answer}
    responses: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    proctoring_logs: Mapped[List["ProctoringLog"]] = relationship(
        "ProctoringLog", back_populates="attempt", cascade="all, delete-orphan"
    )


class ProctoringLog(Base, TenantMixin):
    """
    Telemetry events monitoring integrity validation during candidate tests.
    """
    __tablename__ = "proctoring_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    assessment_attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Event Type: TAB_FOCUS_LOST | PASTE_DETECTED | KEYBOARD_SHORTCUT | CAMERA_FAIL
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Reference indicator e.g. snapshot url or event notes
    evidence_reference: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Custom context telemetry: client browser user agent, resolution, timing
    log_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=text("now()"), nullable=False
    )

    attempt: Mapped["AssessmentAttempt"] = relationship("AssessmentAttempt", back_populates="proctoring_logs")
