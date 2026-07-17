"""
Recruitment Pipeline API
Allows recruiters to view and configure dynamic workflows, update stage progress, and trigger AI evaluations.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.pipeline import ApplicationStage
from app.models.tenant import CompanySettings
from app.services.pipeline import PipelineService, DEFAULT_WORKFLOW

router = APIRouter(prefix="/pipeline", tags=["Recruitment Pipeline"])


class StageUpdateRequest(BaseModel):
    status: str
    score: Optional[float] = None
    feedback: Optional[str] = None
    ai_recommendation: Optional[str] = None
    recruiter_feedback: Optional[str] = None


class WorkflowStageConfig(BaseModel):
    stage_number: int
    stage_name: str
    enabled: bool
    pass_mark: float
    ai_confidence_threshold: float
    require_human_approval: bool
    notifications: Dict[str, bool] = {"email": True, "whatsapp": True, "sms": False, "in_app": True}


class WorkflowUpdateRequest(BaseModel):
    stages: List[WorkflowStageConfig]


class EvaluateStageRequest(BaseModel):
    score: float
    ai_confidence: float = 1.0
    ai_feedback: Optional[str] = None


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
    
    # If PASSED, unlock next stage in sequential order
    if body.status == "PASSED":
        stages_list = await PipelineService.get_pipeline(db, tenant_id, application_id)
        next_stage = None
        for s in stages_list:
            if s.stage_number > stage_number:
                next_stage = s
                break
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


# ── Dynamic Recruitment Workflow Settings ────────────────────────────────────

@router.get("/company/settings/workflow",
            dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def get_company_workflow(db: DBSession, tenant_id: TenantId):
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(CompanySettings).where(CompanySettings.tenant_id == t_uuid)
    settings = (await db.execute(stmt)).scalar_one_or_none()
    
    if not settings or not settings.recruitment_workflow or "stages" not in settings.recruitment_workflow:
        return DEFAULT_WORKFLOW
        
    return settings.recruitment_workflow


@router.patch("/company/settings/workflow",
              dependencies=[Depends(require_role("tenant_admin"))])
async def update_company_workflow(body: WorkflowUpdateRequest, db: DBSession, tenant_id: TenantId):
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(CompanySettings).where(CompanySettings.tenant_id == t_uuid)
    settings = (await db.execute(stmt)).scalar_one_or_none()
    
    if not settings:
        settings = CompanySettings(tenant_id=t_uuid)
        db.add(settings)
        
    # Serialize request body
    stages_serialized = []
    for s in body.stages:
        stages_serialized.append({
            "stage_number": s.stage_number,
            "stage_name": s.stage_name,
            "enabled": s.enabled,
            "pass_mark": s.pass_mark,
            "ai_confidence_threshold": s.ai_confidence_threshold,
            "require_human_approval": s.require_human_approval,
            "notifications": s.notifications
        })
        
    settings.recruitment_workflow = {"stages": stages_serialized}
    await db.commit()
    return {"success": True, "workflow": settings.recruitment_workflow}


@router.post("/applications/{application_id}/stages/{stage_number}/evaluate",
             dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def evaluate_candidate_stage(
    application_id: str, stage_number: int, body: EvaluateStageRequest,
    db: DBSession, tenant_id: TenantId
):
    stage = await PipelineService.evaluate_stage(
        db=db,
        tenant_id=tenant_id,
        application_id=application_id,
        stage_number=stage_number,
        score=body.score,
        ai_confidence=body.ai_confidence,
        ai_feedback=body.ai_feedback
    )
    
    if not stage:
        raise HTTPException(status_code=404, detail="Application stage not found.")
        
    await db.commit()
    return {"success": True, "status": stage.status, "feedback": stage.feedback}


class ScheduleInterviewRequest(BaseModel):
    preferred_slots: List[str]
    interview_type: Optional[str] = "ONLINE"


@router.post("/applications/{application_id}/stages/{stage_number}/schedule-interview",
             dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def schedule_interview_slot(
    application_id: str, stage_number: int, body: ScheduleInterviewRequest,
    db: DBSession, tenant_id: TenantId
):
    from app.services.scheduler_service import SchedulerService
    try:
        result = await SchedulerService.match_slots_and_schedule(
            db=db,
            tenant_id=tenant_id,
            application_id=application_id,
            stage_number=stage_number,
            preferred_slots=body.preferred_slots,
            interview_type=body.interview_type
        )
        await db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/applications/{application_id}/stages/{stage_number}/confirm-interview")
async def confirm_interview_attendance(
    application_id: str, stage_number: int, confirm: bool,
    db: DBSession, tenant_id: TenantId
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
        
    meta = stage.metadata or {}
    meta["candidate_confirmed"] = confirm
    stage.metadata = meta
    await db.commit()
    return {"success": True, "confirmed": confirm}

