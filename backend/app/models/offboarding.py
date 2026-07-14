"""
Offboarding Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class OffboardingPlan(Base, TenantMixin, TimestampMixin):
    """Offboarding plan tracking employee offboarding."""
    __tablename__ = "offboarding_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(320), nullable=False)
    last_day: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)  # RESIGNATION | TERMINATION | RETIREMENT | CONTRACT_END
    exit_interview_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=text("false"))
    exit_feedback: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="INITIATED")  # INITIATED | IN_PROGRESS | COMPLETE


class OffboardingTask(Base, TenantMixin, TimestampMixin):
    """Tasks inside an offboarding plan."""
    __tablename__ = "offboarding_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("offboarding_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # IT | FINANCE | HR | KNOWLEDGE | ASSETS
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")  # PENDING | DONE
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
