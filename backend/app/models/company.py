"""
Phase 1 Models: Teams, Policies, Policy Versions, Company Integrations
Builds on Phase 0 foundation (Tenant, Department, User).
"""
import uuid
from typing import Optional
from datetime import datetime

from sqlalchemy import (
    Boolean, ForeignKey, Integer, String, Text, text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class Team(Base, TenantMixin, TimestampMixin):
    """
    Teams within a department.
    A team belongs to exactly one department and one tenant.
    """
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id from TenantMixin
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    team_lead_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    headcount_target: Mapped[Optional[int]] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PolicyDocument(Base, TenantMixin, TimestampMixin):
    """
    Company policy document (Leave, WFH, Code of Conduct, etc.)
    Policies go through a draft → review → approve → publish lifecycle.
    AI may draft; humans must approve; published version is authoritative.
    """
    __tablename__ = "policy_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id from TenantMixin
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    # leave | attendance | wfh | code_of_conduct | notice_period | benefits
    # compensation | hiring | assessment | interview | offer | onboarding
    # offboarding | data_privacy | acceptable_use | dress_code | expense

    description: Mapped[Optional[str]] = mapped_column(Text)
    current_published_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="draft"
    )
    # draft | under_review | approved | published | archived | superseded

    # Who manages this policy
    policy_owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    requires_legal_review: Mapped[bool] = mapped_column(Boolean, default=False)
    applies_to: Mapped[Optional[list]] = mapped_column(
        JSONB, default=list
    )  # ["all_employees", "remote_employees", "contractors", ...]

    versions: Mapped[list["PolicyVersion"]] = relationship(
        back_populates="policy", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_policy_slug_per_tenant"),
    )

    def __repr__(self) -> str:
        return f"<PolicyDocument '{self.title}' status={self.status}>"


class PolicyVersion(Base, TenantMixin, TimestampMixin):
    """
    Immutable version snapshot of a policy document.
    Every edit creates a new version. Published versions are never edited.
    The HR assistant answers questions only from the published version.
    """
    __tablename__ = "policy_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id from TenantMixin
    policy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("policy_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[str] = mapped_column(String(20), nullable=False)
    # Semantic versioning: "1.0.0", "1.1.0", "2.0.0"

    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="markdown"
    )  # markdown | html | plain

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="draft"
    )
    # draft | under_review | legal_review | approved | published | archived

    # Workflow tracking
    authored_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_ai_drafted: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column()
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column()
    published_at: Mapped[Optional[datetime]] = mapped_column()

    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Effective dates
    effective_from: Mapped[Optional[datetime]] = mapped_column()
    effective_until: Mapped[Optional[datetime]] = mapped_column()

    policy: Mapped["PolicyDocument"] = relationship(back_populates="versions")

    def __repr__(self) -> str:
        return f"<PolicyVersion v{self.version_number} status={self.status}>"


class CompanyIntegration(Base, TenantMixin, TimestampMixin):
    """
    External service integrations per tenant.
    Credentials are NEVER stored in plain text — only encrypted references.
    """
    __tablename__ = "company_integrations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id from TenantMixin
    integration_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # google_calendar | microsoft_graph | smtp_email | slack | teams
    # twilio | zoom | greenhouse | workday | jira | confluence
    # lms_provider | background_check | e_signature | payroll

    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Encrypted credential reference (points to secrets manager key, not raw value)
    credential_ref: Mapped[Optional[str]] = mapped_column(String(500))
    config: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    # Non-sensitive config: scopes, webhook_url, calendar_id, etc.

    last_verified_at: Mapped[Optional[datetime]] = mapped_column()
    verification_error: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("tenant_id", "integration_type", name="uq_integration_per_tenant"),
    )

    def __repr__(self) -> str:
        return f"<CompanyIntegration {self.integration_type} verified={self.is_verified}>"


class SetupWizardState(Base, TenantMixin, TimestampMixin):
    """
    Tracks which steps of the company setup wizard are complete.
    The wizard must be completed before the platform goes live.
    """
    __tablename__ = "setup_wizard_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    # tenant_id from TenantMixin (unique per tenant)

    # Step completion flags
    step_company_profile: Mapped[bool] = mapped_column(Boolean, default=False)
    step_offices: Mapped[bool] = mapped_column(Boolean, default=False)
    step_departments: Mapped[bool] = mapped_column(Boolean, default=False)
    step_hiring_rules: Mapped[bool] = mapped_column(Boolean, default=False)
    step_compliance: Mapped[bool] = mapped_column(Boolean, default=False)
    step_email_integration: Mapped[bool] = mapped_column(Boolean, default=False)
    step_calendar_integration: Mapped[bool] = mapped_column(Boolean, default=False)
    step_sandbox_test: Mapped[bool] = mapped_column(Boolean, default=False)

    # When the wizard was completed and production activated
    completed_at: Mapped[Optional[datetime]] = mapped_column()
    activated_at: Mapped[Optional[datetime]] = mapped_column()
    current_step: Mapped[int] = mapped_column(Integer, default=1)

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_wizard_per_tenant"),
    )

    @property
    def completion_percentage(self) -> int:
        steps = [
            self.step_company_profile, self.step_offices, self.step_departments,
            self.step_hiring_rules, self.step_compliance, self.step_email_integration,
            self.step_calendar_integration, self.step_sandbox_test,
        ]
        return int(sum(steps) / len(steps) * 100)

    @property
    def is_complete(self) -> bool:
        return self.completion_percentage == 100
