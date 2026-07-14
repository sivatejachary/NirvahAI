"""
Compliance, Consent, and Privacy (DSAR) Models
Enforces GDPR, CCPA, and NYC Bias Act audit requirements.
"""
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, ForeignKey, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class ComplianceProfile(Base, TenantMixin, TimestampMixin):
    """
    Tenant compliance configuration mapping to active jurisdictions
    and AI risk classification levels (e.g. EU AI Act High-Risk).
    """
    __tablename__ = "compliance_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    # Active legal frameworks (e.g. GDPR, CCPA, NYC_144, EU_AI_ACT)
    jurisdictions: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    
    # EU AI Act risk classification: UNACCEPTABLE | HIGH | LIMITED | MINIMAL
    ai_risk_classification: Mapped[str] = mapped_column(
        String(50), nullable=False, default="HIGH"
    )
    
    # Audit tracking settings (e.g., selection rate tracking, explanation settings)
    bias_audit_requirements: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    # Flag to prevent candidate indexing without explicit consent
    strict_consent_required: Mapped[bool] = mapped_column(Boolean, default=True)


class ConsentRecord(Base, TenantMixin, TimestampMixin):
    """
    Audit-trail for candidate consent. Required before AI processing.
    """
    __tablename__ = "consent_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    
    # Stage this consent applies to: SOURCING | MCQ | CODING | TECHNICAL_INTERVIEW | VOICE_CALL
    workflow_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    
    consent_status: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_method: Mapped[str] = mapped_column(String(50), nullable=False, default="WEB_FORM")
    
    # IP address or channel used to provide consent
    verification_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AccommodationRequest(Base, TenantMixin, TimestampMixin):
    """
    Accommodations requested by candidate (accessibility, extra time, non-AI evaluation).
    """
    __tablename__ = "accommodation_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    
    # e.g., EXTRA_TIME, SCREEN_READER, MANUAL_EVALUATION, OTHER
    request_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    details: Mapped[str] = mapped_column(Text, nullable=False)
    
    # PENDING | APPROVED | REJECTED | IMPLEMENTED
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    review_notes: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class PrivacyRequest(Base, TenantMixin, TimestampMixin):
    """
    Data Subject Access Request (DSAR) logs for CCPA/GDPR deletions and exports.
    """
    __tablename__ = "privacy_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    # ACCESS | PORTABILITY | DELETION | RESTRICTION
    request_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    candidate_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    
    # PENDING | VERIFYING | PROCESSING | COMPLETED | FAILED | REJECTED
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    
    # Verification tokens/links to ensure applicant is data owner
    verification_token: Mapped[Optional[str]] = mapped_column(String(200))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    execution_log: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
