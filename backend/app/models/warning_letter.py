"""
Warning Letter Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class WarningLetter(Base, TenantMixin, TimestampMixin):
    """Warning letters issued by HR/Managers to employees."""
    __tablename__ = "warning_letters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str] = mapped_column(String(320), nullable=False)
    violation_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ATTENDANCE | PERFORMANCE | CONDUCT | POLICY | OTHER
    description: Mapped[str] = mapped_column(Text, nullable=False)
    letter_content: Mapped[str] = mapped_column(Text, nullable=False)
    issued_by: Mapped[str] = mapped_column(String(255), nullable=False)
    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="DRAFT")  # DRAFT | ISSUED | ACKNOWLEDGED
