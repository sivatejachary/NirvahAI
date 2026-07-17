"""
Candidate Ingestion & Resume Intelligence Router — Phase 5
Enforces screening, rank matching, and candidate evaluation pipelines.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services.application import ApplicationService
from app.models.application import Application

router = APIRouter(prefix="/applications", tags=["Applications & Resume Intelligence"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApplicationIngest(BaseModel):
    job_id: str
    candidate_name: str
    candidate_email: EmailStr
    resume_text: str
    resume_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_job_application(
    db: DBSession,
    tenant_id: TenantId,
    body: ApplicationIngest
):
    try:
        application = await ApplicationService.submit_application(
            db=db,
            tenant_id=tenant_id,
            job_id=body.job_id,
            candidate_name=body.candidate_name,
            candidate_email=body.candidate_email,
            resume_text=body.resume_text,
            resume_url=body.resume_url
        )
        return application
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def list_applications(
    db: DBSession,
    tenant_id: TenantId,
    job_id: Optional[str] = None
):
    import uuid
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(Application).where(Application.tenant_id == t_uuid)
    if job_id:
        stmt = stmt.where(Application.job_id == (uuid.UUID(job_id) if isinstance(job_id, str) else job_id))
        
    stmt = stmt.order_by(Application.fit_score.desc(), Application.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{application_id}", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager"))])
async def get_application_details(
    db: DBSession,
    tenant_id: TenantId,
    application_id: str
):
    app_val = await ApplicationService.get_application(db, tenant_id, application_id)
    if not app_val:
        raise HTTPException(status_code=404, detail="Application posting not found.")
    return app_val


class ApplicationStatusUpdate(BaseModel):
    status: str


@router.patch("/{application_id}/status", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def update_application_status(
    db: DBSession,
    tenant_id: TenantId,
    application_id: str,
    body: ApplicationStatusUpdate
):
    import uuid
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

    stmt = select(Application).where(Application.tenant_id == t_uuid, Application.id == a_uuid)
    res = await db.execute(stmt)
    app_val = res.scalar_one_or_none()
    if not app_val:
        raise HTTPException(status_code=404, detail="Application not found.")

    app_val.status = body.status
    await db.commit()
    await db.refresh(app_val)
    return app_val

