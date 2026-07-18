"""
Selection & Manager Rounds API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update

from app.api.deps import DBSession, TenantId, require_role
from app.models.selection import ManagerInterview
from app.models.application import Application

router = APIRouter(prefix="/selection", tags=["Selection & Manager Rounds"])


class ScheduleRoundRequest(BaseModel):
    application_id: uuid.UUID
    round_type: str  # HR | MANAGER | PANEL | TECHNICAL
    interviewer_name: str
    interviewer_email: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class DecisionRequest(BaseModel):
    decision: str  # PASS | FAIL | HOLD
    rating: Optional[int] = None
    feedback: Optional[str] = None


@router.post("/schedule", status_code=status.HTTP_201_CREATED)
async def schedule_round(
    body: ScheduleRoundRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager")),
):
    # Coerce tenant_id to UUID
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Verify application exists
    app_query = await db.execute(select(Application).where(Application.id == body.application_id, Application.tenant_id == tid))
    app = app_query.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    interview = ManagerInterview(
        application_id=body.application_id,
        round_type=body.round_type,
        interviewer_name=body.interviewer_name,
        interviewer_email=body.interviewer_email,
        scheduled_at=body.scheduled_at,
        tenant_id=tid,
    )
    db.add(interview)
    await db.flush()
    
    # Update application status
    app.status = "INTERVIEW_STAGE"
    await db.flush()

    from app.services.integration_event import EventBusService, EventCatalog
    await EventBusService.publish_event(
        event_type=EventCatalog.CANDIDATE_INTERVIEW_SCHEDULED,
        company_id=tenant_id,
        application_id=str(body.application_id),
        payload={
            "interview_id": str(interview.id),
            "application_id": str(body.application_id),
            "round_type": body.round_type,
            "interviewer_name": body.interviewer_name,
            "interviewer_email": body.interviewer_email,
            "scheduled_at": body.scheduled_at.isoformat() if body.scheduled_at else None
        }
    )
    
    return interview


@router.get("/rounds")
async def get_rounds(
    db: DBSession,
    tenant_id: TenantId,
    decision: Optional[str] = None,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager", "interviewer")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(ManagerInterview).where(ManagerInterview.tenant_id == tid)
    if decision:
        stmt = stmt.where(ManagerInterview.decision == decision)
    stmt = stmt.order_by(ManagerInterview.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{application_id}/rounds")
async def get_rounds_for_application(
    application_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager", "interviewer")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(ManagerInterview).where(
        ManagerInterview.application_id == application_id,
        ManagerInterview.tenant_id == tid
    ).order_by(ManagerInterview.created_at.asc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{round_id}/decision")
async def submit_decision(
    round_id: uuid.UUID,
    body: DecisionRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager", "interviewer")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Load round
    stmt = select(ManagerInterview).where(ManagerInterview.id == round_id, ManagerInterview.tenant_id == tid)
    result = await db.execute(stmt)
    round_obj = result.scalar_one_or_none()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview round not found")
        
    round_obj.decision = body.decision
    if body.rating is not None:
        round_obj.rating = body.rating
    if body.feedback is not None:
        round_obj.feedback = body.feedback
        
    await db.flush()
    
    # If decision is PASS, check if there are any other PENDING rounds for this application
    if body.decision == "PASS":
        pending_stmt = select(ManagerInterview).where(
            ManagerInterview.application_id == round_obj.application_id,
            ManagerInterview.decision == "PENDING",
            ManagerInterview.tenant_id == tid
        )
        pending_result = await db.execute(pending_stmt)
        has_pending = pending_result.scalars().first() is not None
        
        if not has_pending:
            # All manager/HR rounds passed, update application status to SELECTED
            app_stmt = select(Application).where(Application.id == round_obj.application_id, Application.tenant_id == tid)
            app_result = await db.execute(app_stmt)
            app = app_result.scalar_one_or_none()
            if app:
                app.status = "OFFER_STAGE"
                await db.flush()
                
    elif body.decision == "FAIL":
        app_stmt = select(Application).where(Application.id == round_obj.application_id, Application.tenant_id == tid)
        app_result = await db.execute(app_stmt)
        app = app_result.scalar_one_or_none()
        if app:
            app.status = "REJECTED"
            await db.flush()

    return round_obj
