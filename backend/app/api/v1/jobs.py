"""
Job Recruitment & Sourcing Router — Phase 4
Enforces gender-neutral audits, JD generation, and multi-channel publication pipelines.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services.job import JobService
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["Jobs & Sourcing"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class JDGenerateRequest(BaseModel):
    title: str
    department_name: str
    skills: List[str]
    autonomy_level: Optional[str] = "SEMI_AUTONOMOUS"


class JobCreate(BaseModel):
    title: str
    description: str
    department_id: str
    requirements: List[str]


class PublishRequest(BaseModel):
    channels: List[str] # e.g. ["linkedin", "indeed", "glassdoor"]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def generate_job_description(
    db: DBSession,
    tenant_id: TenantId,
    body: JDGenerateRequest
):
    try:
        jd = await JobService.generate_jd_proposal(
            db=db,
            tenant_id=tenant_id,
            title=body.title,
            department_name=body.department_name,
            skills=body.skills,
            autonomy_level=body.autonomy_level
        )
        return jd
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate JD proposal: {str(e)}"
        )


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def create_job(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    body: JobCreate
):
    try:
        job = await JobService.create_job_posting(
            db=db,
            tenant_id=tenant_id,
            title=body.title,
            description=body.description,
            department_id=body.department_id,
            requirements=body.requirements,
            created_by=user_id
        )
        return job
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager"))])
async def list_jobs(
    db: DBSession,
    tenant_id: TenantId,
    status: Optional[str] = None
):
    import uuid
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(Job).where(Job.tenant_id == t_uuid)
    if status:
        stmt = stmt.where(Job.status == status)
        
    stmt = stmt.order_by(Job.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{job_id}")
async def get_job_details(
    db: DBSession,
    tenant_id: TenantId,
    job_id: str
):
    job = await JobService.get_job(db, tenant_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    return job


@router.post("/{job_id}/approve", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def approve_job(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    job_id: str
):
    job = await JobService.approve_job_posting(db, tenant_id, job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found.")
    return job


@router.post("/{job_id}/publish", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def publish_job(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    job_id: str,
    body: PublishRequest
):
    try:
        job = await JobService.publish_and_distribute(
            db=db,
            tenant_id=tenant_id,
            job_id=job_id,
            channels=body.channels,
            user_id=user_id
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job posting not found.")
        return job
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{job_id}", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def delete_job(
    db: DBSession,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    job_id: str
):
    try:
        success = await JobService.delete_job_posting(db, tenant_id, job_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job posting not found.")
        return {"status": "success", "message": "Job deleted and sync request sent to VidyaMarg AI."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
