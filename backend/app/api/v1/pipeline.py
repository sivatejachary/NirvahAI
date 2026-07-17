"""
Recruitment Pipeline API
"""
from typing import Optional
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.pipeline import ApplicationStage
from app.services.pipeline import PipelineService

router = APIRouter(prefix="/pipeline", tags=["Recruitment Pipeline"])


class StageUpdateRequest(BaseModel):
    status: str
    score: Optional[float] = None
    feedback: Optional[str] = None
    ai_recommendation: Optional[str] = None
    recruiter_feedback: Optional[str] = None


@router.get("/applications/{application_id}/stages",
            dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager"))])
async def get_application_pipeline(db: DBSession, tenant_id: TenantId, application_id: str):
    stages = await PipelineService.get_pipeline(db, tenant_id, application_id)
    return [
        {
            "id": str(s.id),
            "stage_number": s.stage_number,
            "stage_name": s.stage_name,
            "status": s.status,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "score": s.score,
            "max_score": s.max_score,
            "feedback": s.feedback,
            "ai_recommendation": s.ai_recommendation,
            "recruiter_feedback": s.recruiter_feedback,
            "ai_evaluated": s.ai_evaluated,
            "manually_overridden": s.manually_overridden,
            "metadata": s.metadata or {},
        }
        for s in stages
    ]


@router.patch("/applications/{application_id}/stages/{stage_number}",
              dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def update_pipeline_stage(
    db: DBSession, tenant_id: TenantId, application_id: str, stage_number: int,
    body: StageUpdateRequest, background_tasks: BackgroundTasks
):
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
    stmt = select(ApplicationStage).where(
        ApplicationStage.tenant_id == t_uuid,
        ApplicationStage.application_id == a_uuid,
        ApplicationStage.stage_number == stage_number
    )
    stage = (await db.execute(stmt)).scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found.")
    stage.status = body.status
    if body.score is not None:
        stage.score = body.score
    if body.feedback:
        stage.feedback = body.feedback
    if body.ai_recommendation:
        stage.ai_recommendation = body.ai_recommendation
    if body.recruiter_feedback:
        stage.recruiter_feedback = body.recruiter_feedback
    stage.manually_overridden = True
    if body.status == "PASSED" and stage_number < 15:
        next_stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number + 1
        )
        next_stage = (await db.execute(next_stmt)).scalar_one_or_none()
        if next_stage and next_stage.status == "LOCKED":
            next_stage.status = "PENDING"
    await db.commit()
    await db.refresh(stage)
    background_tasks.add_task(
        PipelineService._sync_to_vidyamargai,
        application_id=application_id, stage_number=stage_number,
        stage_name=stage.stage_name, status=body.status, score=body.score, feedback=body.feedback
    )
    return {"success": True, "stage": stage.stage_number, "status": stage.status}


@router.post("/applications/{application_id}/initialize",
             dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def initialize_application_pipeline(db: DBSession, tenant_id: TenantId, application_id: str):
    stages = await PipelineService.initialize_pipeline(db, tenant_id, application_id)
    await db.commit()
    return {"success": True, "stages_created": len(stages)}
