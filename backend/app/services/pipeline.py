"""
Recruitment Pipeline Service
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import ApplicationStage, STAGE_NAMES
from app.core.logging import get_logger

logger = get_logger(__name__)

VIDYAMARGAI_SYNC_URL = "https://vidyamargai-production-1fc2.up.railway.app/api/v1"


class PipelineService:
    
    @staticmethod
    async def initialize_pipeline(db: AsyncSession, tenant_id: str, application_id: str) -> List[ApplicationStage]:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        stages = []
        for num in range(1, 16):
            stage = ApplicationStage(
                tenant_id=t_uuid,
                application_id=a_uuid,
                stage_number=num,
                stage_name=STAGE_NAMES[num],
                status="PENDING" if num == 1 else "LOCKED"
            )
            db.add(stage)
            stages.append(stage)
        await db.flush()
        logger.info("PIPELINE_INITIALIZED", application_id=application_id)
        return stages

    @staticmethod
    async def get_pipeline(db: AsyncSession, tenant_id: str, application_id: str) -> List[ApplicationStage]:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid
        ).order_by(ApplicationStage.stage_number)
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def advance_stage(
        db: AsyncSession, tenant_id: str, application_id: str, stage_number: int,
        status: str, score: Optional[float] = None, feedback: Optional[str] = None,
        ai_recommendation: Optional[str] = None, ai_evaluated: bool = False
    ) -> Optional[ApplicationStage]:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        stage_stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number
        )
        stage = (await db.execute(stage_stmt)).scalar_one_or_none()
        if not stage:
            return None
        stage.status = status
        stage.completed_at = datetime.now(timezone.utc)
        if score is not None:
            stage.score = score
        if feedback:
            stage.feedback = feedback
        if ai_recommendation:
            stage.ai_recommendation = ai_recommendation
        stage.ai_evaluated = ai_evaluated
        if status == "PASSED" and stage_number < 15:
            next_stmt = select(ApplicationStage).where(
                ApplicationStage.tenant_id == t_uuid,
                ApplicationStage.application_id == a_uuid,
                ApplicationStage.stage_number == stage_number + 1
            )
            next_stage = (await db.execute(next_stmt)).scalar_one_or_none()
            if next_stage and next_stage.status == "LOCKED":
                next_stage.status = "PENDING"
        await db.flush()
        await PipelineService._sync_to_vidyamargai(
            application_id=application_id, stage_number=stage_number,
            stage_name=STAGE_NAMES.get(stage_number, ""), status=status, score=score, feedback=feedback
        )
        return stage

    @staticmethod
    async def _sync_to_vidyamargai(application_id: str, stage_number: int, stage_name: str,
                                    status: str, score: Optional[float] = None, feedback: Optional[str] = None):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{VIDYAMARGAI_SYNC_URL}/sync/stages",
                    json={"application_id": str(application_id), "stage_number": stage_number,
                          "stage_name": stage_name, "status": status, "score": score, "feedback": feedback}
                )
        except Exception as e:
            logger.warning("VIDYAMARGAI_SYNC_FAILED", error=str(e))
