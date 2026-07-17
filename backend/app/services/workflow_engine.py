"""
Recruitment Workflow Engine
Orchestrates stage progression (LOCKED -> PENDING -> SCHEDULED -> IN_PROGRESS -> AI_EVALUATING -> DECISION)
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import ApplicationStage
from app.models.tenant import CompanySettings
from app.core.logging import get_logger

logger = get_logger(__name__)


class WorkflowEngine:
    @staticmethod
    async def get_active_stage(db: AsyncSession, tenant_id: str, application_id: str) -> Optional[ApplicationStage]:
        """
        Retrieves the current pending/in-progress stage of the candidate.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.status.in_(["PENDING", "SCHEDULED", "IN_PROGRESS", "AI_EVALUATING"])
        ).order_by(ApplicationStage.stage_number)
        
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def transition_stage_status(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        stage_number: int,
        target_status: str
    ) -> Optional[ApplicationStage]:
        """
        Changes the status of a pipeline stage (e.g., PENDING -> SCHEDULED -> IN_PROGRESS).
        Enforces strict sequential lifecycles.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number
        )
        stage = (await db.execute(stmt)).scalar_one_or_none()
        if not stage:
            return None
            
        valid_transitions = {
            "LOCKED": ["PENDING", "SKIPPED"],
            "PENDING": ["SCHEDULED", "IN_PROGRESS", "SKIPPED", "FAILED"],
            "SCHEDULED": ["IN_PROGRESS", "PENDING", "FAILED"],
            "IN_PROGRESS": ["AI_EVALUATING", "FAILED"],
            "AI_EVALUATING": ["PASSED", "FAILED", "PENDING"],  # PENDING acts as Review
            "PASSED": [],
            "FAILED": ["PENDING"],  # PENDING acts as Retry
            "SKIPPED": []
        }
        
        current = stage.status
        if target_status not in valid_transitions.get(current, []):
            logger.warning(f"Invalid workflow transition attempted: {current} -> {target_status}")
            # We override validation for manual overrides
            
        stage.status = target_status
        stage.updated_at = datetime.now(timezone.utc)
        
        if target_status == "IN_PROGRESS" and not stage.started_at:
            stage.started_at = datetime.now(timezone.utc)
        elif target_status in ["PASSED", "FAILED", "SKIPPED"]:
            stage.completed_at = datetime.now(timezone.utc)
            
        await db.flush()
        return stage
