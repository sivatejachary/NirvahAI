"""
Candidate Applications & Screening Models
Tracks application states, blind resume extractions, and job rank matching results.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Float, ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class Application(Base, TenantMixin, TimestampMixin):
    """
    Candidate Job Application entity.
    Tracks ingestion details, parsed metadata, and model grading scores.
    """
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    candidate_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    resume_url: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Status: APPLIED | MCQ_STAGE | CODING_STAGE | INTERVIEW_STAGE | OFFER_STAGE | REJECTED | COMPLETED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="APPLIED")
    
    # Blind parsed resume details: {"skills": [...], "experience_years": 5}
    raw_parsed_data: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    fit_score: Mapped[Optional[float]] = mapped_column(Float)
    screening_feedback: Mapped[Optional[str]] = mapped_column(Text)
