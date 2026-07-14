"""
SQLAlchemy models for Calendar Integrations, Booking Schedules and Geolocation Proximity Routing.
Enforces multi-tenant RLS isolation keys.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class InterviewerSchedule(Base, TenantMixin, TimestampMixin):
    """
    Interviewer profile booking setups, skill keywords and weekly availability slots.
    """
    __tablename__ = "interviewer_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    office_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("company_offices.id", ondelete="SET NULL"), nullable=True
    )

    # List of skills they can grade (e.g. ["Python", "Docker", "Go"])
    skills: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Available slot windows: {"slots": ["2026-07-15T10:00:00", "2026-07-15T11:00:00"]}
    available_slots: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    bookings: Mapped[List["InterviewBooking"]] = relationship(
        "InterviewBooking", back_populates="interviewer", cascade="all, delete-orphan"
    )


class InterviewBooking(Base, TenantMixin, TimestampMixin):
    """
    Candidate booked technical interviewer appointments.
    """
    __tablename__ = "interview_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )

    interviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviewer_schedules.id", ondelete="CASCADE"), nullable=False, index=True
    )

    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    meeting_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    interviewer: Mapped["InterviewerSchedule"] = relationship("InterviewerSchedule", back_populates="bookings")
