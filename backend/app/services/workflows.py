"""
Workflow Manager Service
Tracks recruitment lifecycle transitions and state updates (Temporal mock logic).
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import WorkflowInstance
from app.services.audit import AuditService
from app.core.logging import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkflowService:
    @staticmethod
    async def start_recruitment_workflow(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        initial_state: Optional[Dict[str, Any]] = None
    ) -> WorkflowInstance:
        """
        Starts a candidate recruitment pipeline workflow tracker.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        instance = WorkflowInstance(
            tenant_id=t_uuid,
            application_id=a_uuid,
            current_stage="MCQ",
            status="RUNNING",
            state_data=initial_state or {"history": ["started"]}
        )
        db.add(instance)
        await db.flush()
        
        # Log to audit trail
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="workflow.started",
            actor_type="system",
            entity_type="workflow_instance",
            entity_id=str(instance.id),
            reason_code="WORKFLOW_LAUNCHED",
            reason_summary=f"Recruitment workflow started for application: {application_id}"
        )
        
        return instance

    @staticmethod
    async def get_workflow_instance(
        db: AsyncSession,
        tenant_id: str,
        instance_id: str
    ) -> Optional[WorkflowInstance]:
        stmt = select(WorkflowInstance).where(
            WorkflowInstance.tenant_id == (uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id),
            WorkflowInstance.id == (uuid.UUID(instance_id) if isinstance(instance_id, str) else instance_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def transition_stage(
        cls,
        db: AsyncSession,
        tenant_id: str,
        instance_id: str,
        next_stage: str,
        state_updates: Dict[str, Any]
    ) -> Optional[WorkflowInstance]:
        """
        Transitions recruitment workflow to next stage (e.g. MCQ -> CODING).
        """
        instance = await cls.get_workflow_instance(db, tenant_id, instance_id)
        if not instance:
            return None
            
        old_stage = instance.current_stage
        instance.current_stage = next_stage
        
        # Merge state logs
        current_state = instance.state_data or {}
        history = current_state.get("history", [])
        history.append(f"transitioned from {old_stage} to {next_stage} at {datetime.now(timezone.utc).isoformat()}")
        
        # Update details
        current_state.update(state_updates)
        current_state["history"] = history
        instance.state_data = current_state
        
        if next_stage == "OFFER_ACCEPTED":
            instance.status = "COMPLETED"
            instance.completed_at = _utcnow()
        elif next_stage == "REJECTED":
            instance.status = "FAILED"
            instance.completed_at = _utcnow()
            
        instance.updated_at = _utcnow()
        await db.flush()
        
        # Log to audit trail
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="workflow.transitioned",
            actor_type="system",
            entity_type="workflow_instance",
            entity_id=str(instance.id),
            reason_code="WORKFLOW_TRANSITION",
            reason_summary=f"Workflow transitioned from {old_stage} to {next_stage}."
        )
        
        return instance
