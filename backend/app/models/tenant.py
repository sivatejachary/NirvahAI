"""
Tenant & Company Models
Core multi-tenant isolation foundation.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, utcnow


class Tenant(Base, TimestampMixin):
    """
    Top-level tenant record.
    One tenant = one company (or one isolated workspace).
    """
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_slug: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    legal_name: Mapped[Optional[str]] = mapped_column(String(255))
    industry: Mapped[Optional[str]] = mapped_column(String(100))
    company_size: Mapped[Optional[str]] = mapped_column(String(50))
    website: Mapped[Optional[str]] = mapped_column(String(500))
    email_domain: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending_setup"
    )
    # pending_setup | active | suspended | sandbox | offboarded
    is_sandbox: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="trial")

    # Relationships
    settings: Mapped[Optional["CompanySettings"]] = relationship(
        back_populates="tenant", uselist=False
    )
    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    departments: Mapped[list["Department"]] = relationship(back_populates="tenant")
    offices: Mapped[list["CompanyOffice"]] = relationship(back_populates="tenant")

    def __repr__(self) -> str:
        return f"<Tenant {self.company_slug}>"


class CompanySettings(Base, TimestampMixin):
    """
    Per-tenant operational configuration.
    Autonomy level, working hours, compliance profile, etc.
    """
    __tablename__ = "company_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Autonomy Level: ASSISTED | SEMI_AUTONOMOUS | AUTONOMOUS
    autonomy_level: Mapped[str] = mapped_column(
        String(30), nullable=False, default="ASSISTED"
    )

    # Headquarters and operating configuration
    headquarters_country: Mapped[Optional[str]] = mapped_column(String(100))
    headquarters_city: Mapped[Optional[str]] = mapped_column(String(100))
    operating_countries: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    hiring_countries: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    time_zones: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    # Working hours (JSON: {"monday": {"start": "09:00", "end": "18:00"}, ...})
    working_hours: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    # Public holidays list
    holidays: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    # Hiring policy
    notice_period_days_default: Mapped[int] = mapped_column(Integer, default=30)
    offer_approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    background_verification_required: Mapped[bool] = mapped_column(Boolean, default=True)

    # AI and proctoring settings
    proctoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_interview_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    voice_calls_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Kill switches (emergency overrides)
    kill_automated_rejections: Mapped[bool] = mapped_column(Boolean, default=False)
    kill_proctoring: Mapped[bool] = mapped_column(Boolean, default=False)
    kill_voice_calls: Mapped[bool] = mapped_column(Boolean, default=False)
    kill_all_workflows: Mapped[bool] = mapped_column(Boolean, default=False)

    # Email / branding
    recruiter_display_name: Mapped[Optional[str]] = mapped_column(String(255))
    sender_email: Mapped[Optional[str]] = mapped_column(String(255))

    # Cost budgets
    daily_ai_budget_usd: Mapped[Optional[float]] = mapped_column()
    monthly_ai_budget_usd: Mapped[Optional[float]] = mapped_column()

    # Dynamic sequential recruitment workflow configuration per company
    recruitment_workflow: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    tenant: Mapped["Tenant"] = relationship(back_populates="settings")

    def __repr__(self) -> str:
        return f"<CompanySettings tenant={self.tenant_id} autonomy={self.autonomy_level}>"


class CompanyOffice(Base, TimestampMixin):
    """Company office locations. Used for in-person interview routing."""
    __tablename__ = "company_offices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line1: Mapped[Optional[str]] = mapped_column(String(500))
    address_line2: Mapped[Optional[str]] = mapped_column(String(500))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    time_zone: Mapped[Optional[str]] = mapped_column(String(100))
    maps_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="offices")


class Department(Base, TimestampMixin):
    """Company departments."""
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    parent_department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="departments")


# Circular imports resolved by TYPE_CHECKING guard
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.user import User
