"""
SQLAlchemy models for Hackathon Project Evaluator and Plagiarism Code Defense Portal.
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


class HackathonSubmission(Base, TenantMixin, TimestampMixin):
    """
    Project hackathon snapshots uploaded by candidates.
    """
    __tablename__ = "hackathon_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )

    repo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Core source code snapshot to evaluate and defend
    code_snapshot: Mapped[str] = mapped_column(Text, nullable=False)

    # Status: SUBMITTED | EVALUATING | GRADED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="SUBMITTED")

    # Metrics
    architecture_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    test_pass_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evaluation_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Code defense verification dialog
    code_defenses: Mapped[List["CodeDefense"]] = relationship(
        "CodeDefense", back_populates="submission", cascade="all, delete-orphan"
    )


class CodeDefense(Base, TenantMixin):
    """
    Plagiarism defense dialogue validating if the candidate actually wrote the snapshot code.
    """
    __tablename__ = "code_defenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hackathon_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Question targeting candidate code syntax logic
    defense_question: Mapped[str] = mapped_column(Text, nullable=False)

    # Candidate explanation text
    candidate_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Plagiarism Risk check: LOW | MEDIUM | HIGH
    plagiarism_risk: Mapped[str] = mapped_column(String(50), nullable=False, default="LOW")

    # Explanation quality score
    defense_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), default=datetime.utcnow, nullable=False
    )

    submission: Mapped["HackathonSubmission"] = relationship("HackathonSubmission", back_populates="code_defenses")
