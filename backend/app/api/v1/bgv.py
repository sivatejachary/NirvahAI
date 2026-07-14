"""
Background Verification API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.bgv import BackgroundCheck
from app.models.application import Application

router = APIRouter(prefix="/bgv", tags=["Background Verification"])


class InitiateBGVRequest(BaseModel):
    application_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    check_types: List[str]  # CRIMINAL | EDUCATION | EMPLOYMENT | REFERENCE | CREDIT
    vendor: Optional[str] = "Nirvah BGV Agent"


class UpdateBGVStatusRequest(BaseModel):
    status: str  # PENDING | CLEAR | FLAGGED | FAILED
    notes: Optional[str] = None
    report_url: Optional[str] = None


@router.post("/initiate", status_code=status.HTTP_201_CREATED)
async def initiate_bgv(
    body: InitiateBGVRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Verify application exists
    app_query = await db.execute(select(Application).where(Application.id == body.application_id, Application.tenant_id == tid))
    app = app_query.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    created_checks = []
    for check_type in body.check_types:
        check = BackgroundCheck(
            application_id=body.application_id,
            candidate_name=body.candidate_name,
            candidate_email=body.candidate_email,
            check_type=check_type,
            status="INITIATED",
            vendor=body.vendor,
            initiated_at=datetime.utcnow(),
            tenant_id=tid,
        )
        db.add(check)
        created_checks.append(check)
        
    await db.flush()
    return created_checks


@router.get("")
async def get_all_bgv_checks(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(BackgroundCheck).where(BackgroundCheck.tenant_id == tid).order_by(BackgroundCheck.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{application_id}")
async def get_bgv_checks_for_candidate(
    application_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(BackgroundCheck).where(
        BackgroundCheck.application_id == application_id,
        BackgroundCheck.tenant_id == tid
    ).order_by(BackgroundCheck.created_at.asc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{check_id}/status")
async def update_bgv_status(
    check_id: uuid.UUID,
    body: UpdateBGVStatusRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(BackgroundCheck).where(BackgroundCheck.id == check_id, BackgroundCheck.tenant_id == tid)
    result = await db.execute(stmt)
    check = result.scalar_one_or_none()
    if not check:
        raise HTTPException(status_code=404, detail="Background check not found")
        
    check.status = body.status
    if body.notes is not None:
        check.notes = body.notes
    if body.report_url is not None:
        check.report_url = body.report_url
        
    if body.status in ["CLEAR", "FLAGGED", "FAILED"]:
        check.completed_at = datetime.utcnow()
        
    await db.flush()
    return check
