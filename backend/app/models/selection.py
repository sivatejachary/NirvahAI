"""
Selection & Manager Rounds Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class ManagerInterview(Base, TenantMixin, TimestampMixin):
    """Manager/HR/Panel interview round for a candidate."""
    __tablename__ = "manager_interviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_type: Mapped[str] = mapped_column(String(50), nullable=False, default="HR")  # HR | MANAGER | PANEL | TECHNICAL
    interviewer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    interviewer_email: Mapped[Optional[str]] = mapped_column(String(320))
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    feedback: Mapped[Optional[str]] = mapped_column(Text)
    rating: Mapped[Optional[int]] = mapped_column(Integer)  # 1-5
    decision: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")  # PENDING | PASS | FAIL | HOLD
    notes: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
