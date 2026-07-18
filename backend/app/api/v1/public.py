"""
Public Candidate Portal Router — Phase 5
Exposes unauthenticated endpoints for candidate consent, applications, accommodations and DSAR.
Tenant context is resolved from the X-Tenant-Slug header.
"""
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, TenantId
from app.services.application import ApplicationService
from app.services.assessment import AssessmentService
from app.services import compliance as compliance_svc
from app.api.v1.compliance import ConsentRecordCreate, AccommodationRequestCreate, PrivacyRequestCreate

router = APIRouter(prefix="/public", tags=["Public Candidate Portal"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApplicationIngest(BaseModel):
    job_id: str
    candidate_name: str
    candidate_email: EmailStr
    resume_text: str
    resume_url: Optional[str] = None
    gdpr_consent: bool = False  # When True, auto-records consent so candidate does not need a prior consent step


class CandidateConsentByEmail(BaseModel):
    """Simpler consent form — accepts email instead of raw UUID so candidate portals can submit consent easily."""
    candidate_email: EmailStr
    workflow_stage: str = "APPLICATION"
    consent_status: bool = True
    consent_method: str = "WEB_FORM"
    verification_metadata: Optional[Dict[str, Any]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/jobs")
async def public_list_jobs(
    db: DBSession,
    tenant_id: TenantId,
):
    """
    List all PUBLISHED jobs for this tenant — no auth required.
    Used by VidyamargAI candidate portal to browse open positions.
    """
    from sqlalchemy import select, text
    from app.models.job import Job
    import uuid as _uuid

    t_uuid = _uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    stmt = select(Job).where(
        Job.tenant_id == t_uuid,
        Job.status == "PUBLISHED"
    ).order_by(Job.created_at.desc())
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "title": j.title,
            "description": j.description,
            "requirements": j.requirements or [],
            "employment_type": getattr(j, "employment_type", None) or "FULL_TIME",
            "location_type": getattr(j, "location_type", None) or "REMOTE",
            "salary_min": getattr(j, "salary_min", None),
            "salary_max": getattr(j, "salary_max", None),
            "currency": getattr(j, "currency", None) or "USD",
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@router.get("/jobs/{job_id}")
async def public_get_job(
    db: DBSession,
    tenant_id: TenantId,
    job_id: str,
):
    """
    Get a single published job by ID — no auth required.
    """
    from sqlalchemy import select, text
    from app.models.job import Job
    import uuid as _uuid

    t_uuid = _uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    j_uuid = _uuid.UUID(job_id) if isinstance(job_id, str) else job_id
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    stmt = select(Job).where(
        Job.tenant_id == t_uuid,
        Job.id == j_uuid,
        Job.status == "PUBLISHED"
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "id": str(job.id),
        "title": job.title,
        "description": job.description,
        "requirements": job.requirements or [],
        "employment_type": getattr(job, "employment_type", None) or "FULL_TIME",
        "location_type": getattr(job, "location_type", None) or "REMOTE",
        "salary_min": getattr(job, "salary_min", None),
        "salary_max": getattr(job, "salary_max", None),
        "currency": getattr(job, "currency", None) or "USD",
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.post("/consent/by-email", status_code=status.HTTP_200_OK)
async def public_record_consent_by_email(
    db: DBSession,
    tenant_id: TenantId,
    consent_data: CandidateConsentByEmail,
):
    """
    Record consent using candidate email (derives UUID5 consistent with application service).
    This is the recommended endpoint for VidyamargAI and the candidate portal.
    """
    # Derive deterministic UUID from email — same logic as ApplicationService
    candidate_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(consent_data.candidate_email))
    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    record = await compliance_svc.log_consent(
        db,
        tenant_id=tenant_id,
        candidate_id=str(candidate_uuid),
        workflow_stage=consent_data.workflow_stage,
        consent_status=consent_data.consent_status,
        consent_method=consent_data.consent_method,
        verification_metadata=consent_data.verification_metadata or {},
    )
    return {"status": "ok", "candidate_uuid": str(candidate_uuid), "consent_status": consent_data.consent_status}


@router.post("/applications", status_code=status.HTTP_201_CREATED)
async def public_submit_application(
    db: DBSession,
    tenant_id: TenantId,
    body: ApplicationIngest
):
    """
    Candidate submit application endpoint. Resolves Tenant context from X-Tenant-Slug.
    """

    try:
        from sqlalchemy import text
        if "sqlite" not in str(db.bind.url):
            await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

        # Auto-record consent when candidate explicitly agrees at apply-time
        if body.gdpr_consent:
            candidate_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(body.candidate_email))
            await compliance_svc.log_consent(
                db,
                tenant_id=tenant_id,
                candidate_id=str(candidate_uuid),
                workflow_stage="APPLICATION",
                consent_status=True,
                consent_method="AUTO_APPLY",
                verification_metadata={"source": "VidyamargAI auto-apply"},
            )

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


@router.get("/applications/status")
async def public_get_application_status(
    db: DBSession,
    tenant_id: TenantId,
    email: Optional[str] = None,
    application_id: Optional[str] = None,
):
    """
    Get application status for candidate by email or application_id — no auth required.
    Used by VidyamargAI to display candidate application status in real-time.
    """
    from sqlalchemy import select, text
    from app.models.application import Application
    from app.models.job import Job
    import uuid as _uuid

    t_uuid = _uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    stmt = select(Application, Job.title.label("job_title")).join(Job, Application.job_id == Job.id).where(Application.tenant_id == t_uuid)
    
    if application_id:
        try:
            app_uuid = _uuid.UUID(application_id)
            stmt = stmt.where(Application.id == app_uuid)
        except ValueError:
            pass
    elif email:
        stmt = stmt.where(Application.candidate_email == email.strip())
    else:
        return []

    stmt = stmt.order_by(Application.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    STATUS_MAP = {
        "APPLIED": "applied",
        "MCQ_STAGE": "applied",
        "CODING_STAGE": "interview_scheduled",
        "INTERVIEW_STAGE": "interview_scheduled",
        "OFFER_STAGE": "offer_received",
        "COMPLETED": "offer_received",
        "REJECTED": "rejected",
    }

    return [
        {
            "id": str(app.id),
            "job_id": str(app.job_id),
            "job_title": job_title,
            "company_name": "NirvahAI HR Agent",
            "candidate_name": app.candidate_name,
            "candidate_email": app.candidate_email,
            "raw_status": app.status,
            "status": STATUS_MAP.get(app.status, "applied"),
            "fit_score": app.fit_score,
            "applied_at": app.created_at.isoformat() if app.created_at else None,
        }
        for app, job_title in rows
    ]


@router.post("/consent")
async def public_record_consent(
    db: DBSession,
    tenant_id: TenantId,
    consent_data: ConsentRecordCreate
):
    """
    Candidate records consent from transparency portal.
    Accepts UUID or derives one from candidate_id string safely.
    """
    # Safely convert candidate_id — if it's not a UUID, derive one via uuid5
    candidate_id = consent_data.candidate_id
    try:
        uuid.UUID(str(candidate_id))
    except (ValueError, AttributeError):
        candidate_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(candidate_id)))

    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    record = await compliance_svc.log_consent(
        db,
        tenant_id=tenant_id,
        candidate_id=candidate_id,
        workflow_stage=consent_data.workflow_stage,
        consent_status=consent_data.consent_status,
        consent_method=consent_data.consent_method,
        verification_metadata=consent_data.verification_metadata
    )
    return record


@router.post("/accommodations")
async def public_request_accommodation(
    db: DBSession,
    tenant_id: TenantId,
    acc_data: AccommodationRequestCreate
):
    """
    Candidate submits accessibility / manual bypass accommodations.
    """
    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    req = await compliance_svc.create_accommodation_request(
        db,
        tenant_id=tenant_id,
        candidate_id=acc_data.candidate_id,
        request_type=acc_data.request_type,
        details=acc_data.details
    )
    return req


@router.post("/privacy-requests")
async def public_request_privacy_action(
    db: DBSession,
    tenant_id: TenantId,
    dsar: PrivacyRequestCreate
):
    """
    Candidate initiates DSAR deletion / access request.
    """
    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    req = await compliance_svc.create_privacy_request(
        db,
        tenant_id=tenant_id,
        request_type=dsar.request_type,
        candidate_email=dsar.candidate_email
    )
    return {
        "request_id": str(req.id),
        "status": req.status,
        "message": "Privacy request initiated. Verification code has been issued."
    }


@router.post("/privacy-requests/{request_id}/verify")
async def public_verify_privacy_action(
    db: DBSession,
    tenant_id: TenantId,
    request_id: str,
    token: str
):
    """
    Candidate verifies email ownership for DSAR request.
    """
    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    verified = await compliance_svc.verify_privacy_request(db, tenant_id, request_id, token)
    if not verified:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Invalid verification token or request already verified."
      )
    return {"status": "VERIFIED", "message": "Email ownership verified successfully."}


# ── Assessment Schemas ────────────────────────────────────────────────────────

class AssessmentAttemptStart(BaseModel):
    application_id: str
    type: Optional[str] = "MCQ"


class AssessmentAnswerSubmit(BaseModel):
    question_id: str
    candidate_answer: str


class ProctorTelemetryLog(BaseModel):
    event_type: str
    metadata: Optional[Dict[str, Any]] = None
    evidence_reference: Optional[str] = None


# ── Assessment Endpoints ──────────────────────────────────────────────────────

@router.post("/assessments/attempts", status_code=status.HTTP_201_CREATED)
async def public_start_assessment(
    db: DBSession,
    tenant_id: TenantId,
    body: AssessmentAttemptStart
):
    """
    Starts an unauthenticated assessment attempt for a candidate application.
    """
    try:
        from sqlalchemy import text
        if "sqlite" not in str(db.bind.url):
            await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        attempt = await AssessmentService.start_assessment_attempt(
            db=db,
            tenant_id=tenant_id,
            application_id=body.application_id,
            type=body.type
        )
        return {
            "attempt_id": str(attempt.id),
            "status": attempt.status,
            "type": attempt.type
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/assessments/attempts/{attempt_id}/next")
async def public_get_next_question(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str
):
    """
    Fetch the next unanswered MCQ question details for this candidate attempt.
    """
    from app.services.assessment import AssessmentService
    try:
        from sqlalchemy import text
        if "sqlite" not in str(db.bind.url):
            await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        q = await AssessmentService.get_next_question(db, tenant_id, attempt_id)
        if not q:
            return {"finished": True, "question": None}
        return {
            "finished": False,
            "question": {
                "id": str(q.id),
                "question_text": q.question_text,
                "options": q.options,
                "difficulty": q.difficulty
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/assessments/attempts/{attempt_id}/submit")
async def public_submit_response(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str,
    body: AssessmentAnswerSubmit
):
    """
    Submit answer selection for a question.
    """
    from app.services.assessment import AssessmentService
    try:
        from sqlalchemy import text
        if "sqlite" not in str(db.bind.url):
            await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        attempt = await AssessmentService.submit_mcq_response(
            db=db,
            tenant_id=tenant_id,
            attempt_id=attempt_id,
            question_id=body.question_id,
            candidate_answer=body.candidate_answer
        )
        return {
            "status": attempt.status,
            "score": attempt.score
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/assessments/attempts/{attempt_id}/proctor")
async def public_submit_proctor_log(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str,
    body: ProctorTelemetryLog
):
    """
    Saves proctor tab focus loss or anti-cheat evidence events.
    """
    from app.services.assessment import AssessmentService
    try:
        from sqlalchemy import text
        if "sqlite" not in str(db.bind.url):
            await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        log = await AssessmentService.log_proctoring_telemetry(
            db=db,
            tenant_id=tenant_id,
            attempt_id=attempt_id,
            event_type=body.event_type,
            metadata=body.metadata,
            evidence_reference=body.evidence_reference
        )
        return {"status": "LOGGED", "log_id": str(log.id)}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
