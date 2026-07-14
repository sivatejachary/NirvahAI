"""
Recruiter Assessment Router — Phase 6
Allows recruiters to review candidate assessment attempts, grades, proctoring telemetry, and anti-cheat indicators.
"""
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, TenantId, require_permission
from app.models.assessment import AssessmentAttempt, ProctoringLog

router = APIRouter(prefix="/assessments", tags=["Recruiter Assessments & Proctoring"])


@router.get("/attempts")
async def list_assessment_attempts(
    db: DBSession,
    tenant_id: TenantId,
    application_id: Optional[str] = None,
    _=Depends(require_permission("assessments:read"))
):
    """
    Lists candidate assessment attempts for the tenant. Enables filter by application.
    """
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(AssessmentAttempt).where(AssessmentAttempt.tenant_id == t_uuid)
    
    if application_id:
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        stmt = stmt.where(AssessmentAttempt.application_id == a_uuid)

    stmt = stmt.order_by(AssessmentAttempt.created_at.desc())
    results = (await db.execute(stmt)).scalars().all()
    
    return [
        {
            "id": str(att.id),
            "application_id": str(att.application_id),
            "type": att.type,
            "score": att.score,
            "status": att.status,
            "integrity_risk": att.integrity_risk,
            "created_at": att.created_at,
            "updated_at": att.updated_at
        }
        for att in results
    ]


@router.get("/attempts/{attempt_id}")
async def get_attempt_details(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str,
    _=Depends(require_permission("assessments:read"))
):
    """
    Returns full details of an assessment attempt including custom responses and proctoring telemetry logs.
    """
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id

    stmt = select(AssessmentAttempt).where(
        AssessmentAttempt.tenant_id == t_uuid,
        AssessmentAttempt.id == att_uuid
    ).options(selectinload(AssessmentAttempt.proctoring_logs))
    
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment attempt not found."
        )

    return {
        "id": str(attempt.id),
        "application_id": str(attempt.application_id),
        "type": attempt.type,
        "score": attempt.score,
        "status": attempt.status,
        "integrity_risk": attempt.integrity_risk,
        "responses": attempt.responses,
        "created_at": attempt.created_at,
        "updated_at": attempt.updated_at,
        "proctoring_logs": [
            {
                "id": str(log.id),
                "event_type": log.event_type,
                "evidence_reference": log.evidence_reference,
                "metadata": log.log_metadata,
                "created_at": log.created_at
            }
            for log in attempt.proctoring_logs
        ]
    }
