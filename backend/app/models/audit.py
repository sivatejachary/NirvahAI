"""
Audit Log and Security Event Models
Every autonomous agent action, user action, and security event is recorded here.
This is the tamper-evident audit trail of the system.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class AuditLog(Base, TimestampMixin):
    """
    Immutable audit record for every significant action.
    Written by:
    - User actions (via API)
    - Autonomous agent actions
    - System events (workflow transitions)

    Never delete audit logs. Archive according to retention policy.
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Actor: who triggered this (null = system)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    actor_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # user | agent | system | candidate

    # Action classification
    action: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    # e.g. application.submitted, resume.screened, offer.sent, agent.workflow_transition

    # Entity being acted on
    entity_type: Mapped[Optional[str]] = mapped_column(String(100))
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    # Structured reason (NOT LLM chain-of-thought)
    reason_code: Mapped[Optional[str]] = mapped_column(String(200))
    reason_summary: Mapped[Optional[str]] = mapped_column(Text)

    # References to input data used (e.g. resume_id, assessment_id)
    input_references: Mapped[Optional[dict]] = mapped_column(JSONB)
    # Output summary (non-sensitive structured data)
    output_summary: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Agent versioning (when action is by an agent)
    agent_name: Mapped[Optional[str]] = mapped_column(String(200))
    agent_version: Mapped[Optional[str]] = mapped_column(String(50))
    prompt_version: Mapped[Optional[str]] = mapped_column(String(50))
    workflow_version: Mapped[Optional[str]] = mapped_column(String(50))
    model_version: Mapped[Optional[str]] = mapped_column(String(100))

    # Correlation for distributed tracing
    correlation_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    causation_id: Mapped[Optional[str]] = mapped_column(String(100))

    # Request metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="success")
    # success | failure | pending | blocked

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} tenant={self.tenant_id}>"


class SecurityEvent(Base, TimestampMixin):
    """
    Security-specific events: login failures, tenant boundary violations,
    unauthorized access attempts, suspicious activity.
    """
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # tenant_boundary_violation | failed_login | invalid_token | rate_limit_exceeded
    # prompt_injection_attempt | sandbox_escape_attempt

    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    # low | medium | high | critical

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    path: Mapped[Optional[str]] = mapped_column(String(500))
    details: Mapped[Optional[dict]] = mapped_column(JSONB)

    resolved: Mapped[bool] = mapped_column(default=False)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    resolved_at: Mapped[Optional[str]] = mapped_column()

    def __repr__(self) -> str:
        return f"<SecurityEvent {self.event_type} severity={self.severity}>"
