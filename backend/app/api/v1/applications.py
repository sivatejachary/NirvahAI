"""
Candidate Ingestion & Resume Intelligence Router — Phase 5
Enforces screening, rank matching, and candidate evaluation pipelines.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, text

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

    # Bypass RLS so HR users can read across all candidates for this tenant
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

    stmt = select(Application).where(Application.tenant_id == t_uuid)
    if job_id:
        stmt = stmt.where(Application.job_id == (uuid.UUID(job_id) if isinstance(job_id, str) else job_id))

    stmt = stmt.order_by(Application.fit_score.desc(), Application.created_at.desc())
    result = await db.execute(stmt)
    apps = result.scalars().all()

    # Serialize to dict so UUIDs and datetimes are properly JSON-encoded
    return [
        {
            "id": str(a.id),
            "job_id": str(a.job_id),
            "tenant_id": str(a.tenant_id),
            "candidate_name": a.candidate_name,
            "candidate_email": a.candidate_email,
            "resume_url": a.resume_url,
            "status": a.status,
            "fit_score": a.fit_score or 0.0,
            "screening_feedback": a.screening_feedback,
            "raw_parsed_data": a.raw_parsed_data,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in apps
    ]


@router.get("/{application_id}", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager"))])
async def get_application_details(
    db: DBSession,
    tenant_id: TenantId,
    application_id: str
):
    import uuid
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    app_val = await ApplicationService.get_application(db, tenant_id, application_id)
    if not app_val:
        raise HTTPException(status_code=404, detail="Application posting not found.")
    return {
        "id": str(app_val.id),
        "job_id": str(app_val.job_id),
        "tenant_id": str(app_val.tenant_id),
        "candidate_name": app_val.candidate_name,
        "candidate_email": app_val.candidate_email,
        "resume_url": app_val.resume_url,
        "status": app_val.status,
        "fit_score": app_val.fit_score or 0.0,
        "screening_feedback": app_val.screening_feedback,
        "raw_parsed_data": app_val.raw_parsed_data,
        "created_at": app_val.created_at.isoformat() if app_val.created_at else None,
        "updated_at": app_val.updated_at.isoformat() if app_val.updated_at else None,
    }


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

    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

    stmt = select(Application).where(Application.tenant_id == t_uuid, Application.id == a_uuid)
    res = await db.execute(stmt)
    app_val = res.scalar_one_or_none()
    if not app_val:
        raise HTTPException(status_code=404, detail="Application not found.")

    app_val.status = body.status
    await db.commit()
    await db.refresh(app_val)
    return {
        "id": str(app_val.id),
        "job_id": str(app_val.job_id),
        "status": app_val.status,
        "fit_score": app_val.fit_score or 0.0,
        "candidate_name": app_val.candidate_name,
        "candidate_email": app_val.candidate_email,
    }


# ── Resume File Upload ────────────────────────────────────────────────────────
@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))],
    summary="Upload a candidate resume (PDF or DOCX)",
)
async def upload_resume(
    file: UploadFile = File(...),
    tenant_id: TenantId = None,
):
    """
    Accepts a resume file (PDF/DOCX) and returns:
    - Extracted text preview
    - A mock storage URL for use in application submission
    """
    allowed_types = {
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {file.content_type}. Must be PDF or DOCX."
        )

    contents = await file.read()
    file_size_kb = len(contents) / 1024

    # Extract text preview (first 500 chars raw bytes preview for PDFs)
    try:
        text_preview = contents[:500].decode("utf-8", errors="ignore")
    except Exception:
        text_preview = "[Binary content — PDF/DOCX parsing would run server-side]"

    # Generate a mock storage URL (in production this would upload to S3/R2)
    import uuid as uuid_mod
    mock_storage_url = f"https://storage.nirvahai.com/resumes/{uuid_mod.uuid4().hex}/{file.filename}"

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size_kb": round(file_size_kb, 2),
        "storage_url": mock_storage_url,
        "text_preview": text_preview[:200],
        "status": "uploaded",
        "message": "Resume uploaded successfully. Use storage_url in your application submission.",
    }
