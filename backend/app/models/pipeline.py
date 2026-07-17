"""
Recruitment Pipeline Stage Tracking Model
Stores per-stage status, scoring, feedback, and timestamps for the 15-stage AI recruitment pipeline.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text, DateTime, text, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TenantMixin


STAGE_NAMES = {
    1: "Resume Screening",
    2: "MCQ Assessment",
    3: "Coding Assessment",
    4: "AI Technical Interview",
    5: "Hackathon / Assignment",
    6: "AI HR Call (Post-Technical)",
    7: "Technical Interview (Human)",
    8: "AI HR Call (Post-Interview)",
    9: "HR / Hiring Manager Round",
    10: "AI HR Call (Pre-Offer)",
    11: "Offer Letter",
    12: "AI HR Call (Post-Offer)",
    13: "Background Verification",
    14: "AI HR Call (BGV Update)",
    15: "Joining & Onboarding",
}


class ApplicationStage(Base, TenantMixin):
    __tablename__ = "application_stages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    stage_number: Mapped[int] = mapped_column(Integer, nullable=False)
    stage_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="LOCKED")
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=100.0)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recruiter_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    ai_evaluated: Mapped[bool] = mapped_column(Boolean, default=False)
    manually_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, server_default=text("now()")
    )
