"""
SQLAlchemy models for Coding Challenges and Candidate Sandboxed Submissions.
Enforces multi-tenant RLS isolation keys.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import Boolean, ForeignKey, String, Text, text, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin, utcnow


class CodingChallenge(Base, TenantMixin, TimestampMixin):
    """
    Coding challenges configured by recruiters per job.
    """
    __tablename__ = "coding_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Starter codes template for different languages e.g., {"python": "def solution()...", "javascript": "..."}
    starter_code: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Test cases array e.g., [{"input": "2\n3\n", "output": "5\n", "hidden": false}]
    test_cases: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)


class CodingSubmission(Base, TenantMixin, TimestampMixin):
    """
    Candidate coding assessment run/submit history logs.
    """
    __tablename__ = "coding_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    assessment_attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coding_challenges.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Submitted source code content
    code: Mapped[str] = mapped_column(Text, nullable=False)

    # Language used: python | javascript | go | cpp
    language: Mapped[str] = mapped_column(String(50), nullable=False)

    # Evaluation status outcome: ACCEPTED | WRONG_ANSWER | COMPILE_ERROR | TIMEOUT | RUNTIME_ERROR
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")

    # Detailed execution logs e.g. [{"input": "...", "expected": "...", "got": "...", "passed": true}]
    results: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
