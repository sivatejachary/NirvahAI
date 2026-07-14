"""
Background Verification Models
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class BackgroundCheck(Base, TenantMixin, TimestampMixin):
    """Background verification check details for a candidate."""
    __tablename__ = "background_checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    candidate_email: Mapped[str] = mapped_column(String(320), nullable=False)
    check_type: Mapped[str] = mapped_column(String(50), nullable=False)  # CRIMINAL | EDUCATION | EMPLOYMENT | REFERENCE | CREDIT
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="INITIATED")  # INITIATED | PENDING | CLEAR | FLAGGED | FAILED
    vendor: Mapped[Optional[str]] = mapped_column(String(255))
    report_url: Mapped[Optional[str]] = mapped_column(String(500))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    initiated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
