"""
Performance & Review Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Float, Integer, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class PerformanceReview(Base, TenantMixin, TimestampMixin):
    """Annual/Quarterly employee performance review cycles."""
    __tablename__ = "performance_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(320), nullable=False)
    review_period: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., Q1 2026
    reviewer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    goals: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'"))
    ratings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'"))
    overall_score: Mapped[Optional[float]] = mapped_column(Float)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="DRAFT")  # DRAFT | SUBMITTED | APPROVED


class PerformanceGoal(Base, TenantMixin, TimestampMixin):
    """Goals set for employees to track progress."""
    __tablename__ = "performance_goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-100
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ACTIVE")  # ACTIVE | COMPLETED | CANCELLED
