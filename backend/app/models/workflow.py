"""
Workflow Execution Engine Models
Tracks durable recruitment and operations workflow instances.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, TenantMixin


class WorkflowInstance(Base, TenantMixin, TimestampMixin):
    """
    Instance of a background hiring workflow (e.g. MCQ -> Coding -> Tech Interview).
    Acts as a durable state tracker for Temporal workflows or local task runner.
    """
    __tablename__ = "workflow_instances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    # Linked application (UUID)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Workflow Stage: MCQ | CODING | TECHNICAL_INTERVIEW | VOICE_CALL | HUMAN_FEEDBACK | OFFER
    current_stage: Mapped[str] = mapped_column(String(50), nullable=False, default="MCQ")
    
    # Workflow Status: PENDING | RUNNING | WAITING_ON_CANDIDATE | FAILED | COMPLETED
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    
    # Serialized state parameters and history logs
    state_data: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
