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
        return {
            "id": str(job.id),
            "tenant_id": str(job.tenant_id),
            "title": job.title,
            "description": job.description,
            "department_id": str(job.department_id),
            "requirements": job.requirements,
            "status": job.status,
            "sourcing_channels": job.sourcing_channels,
            "employment_type": job.employment_type,
            "location_type": job.location_type,
        }
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
        return {
            "id": str(job.id),
            "tenant_id": str(job.tenant_id),
            "title": job.title,
            "description": job.description,
            "status": job.status,
            "sourcing_channels": job.sourcing_channels,
            "requirements": job.requirements,
            "employment_type": job.employment_type,
            "location_type": job.location_type,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job publish failed: {str(e)}")


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


@router.get("/redis-check", dependencies=[])
async def check_redis_integration_state():
    try:
        from app.core.redis import get_redis
        import json
        redis = get_redis()
        is_mock = "MockRedis" in str(type(redis))
        
        # Check lengths
        q_len = 0
        dlq_len = 0
        q_items = []
        dlq_items = []
        
        if is_mock:
            data = getattr(redis, "_data", {})
            q_list = data.get("integration:events_queue", [])
            dlq_list = data.get("integration:events_dlq", [])
            q_len = len(q_list)
            dlq_len = len(dlq_list)
            q_items = q_list[:10]
            dlq_items = dlq_list[:10]
        else:
            q_len = await redis.llen("integration:events_queue")
            dlq_len = await redis.llen("integration:events_dlq")
            for i in range(min(10, q_len)):
                item = await redis.lindex("integration:events_queue", i)
                q_items.append(item)
            for i in range(min(10, dlq_len)):
                item = await redis.lindex("integration:events_dlq", i)
                dlq_items.append(item)
                
        from app.services.integration_event import EventBusService
        worker_status = "NONE"
        if EventBusService._worker_task:
            worker_status = "DONE" if EventBusService._worker_task.done() else "RUNNING"
            if EventBusService._worker_task.done():
                try:
                    EventBusService._worker_task.result()
                except Exception as ex:
                    worker_status = f"CRASHED: {ex}"
                    
        return {
            "redis_type": str(type(redis)),
            "is_mock": is_mock,
            "events_queue_length": q_len,
            "events_dlq_length": dlq_len,
            "events_queue_items": q_items,
            "events_dlq_items": dlq_items,
            "worker_task_status": worker_status,
            "integration_service_url": settings.INTEGRATION_SERVICE_URL
        }
    except Exception as e:
        return {"error": str(e)}
