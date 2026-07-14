"""
Public Hackathon & Code Defense Router — Phase 9
Allows candidates to upload project snapshots and complete authorship defense questions.
Resolved via X-Tenant-Slug headers.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId
from app.models.hackathon import HackathonSubmission, CodeDefense
from app.services.hackathon import HackathonService

router = APIRouter(prefix="/public/hackathons", tags=["Public Candidate Code Defense Portal"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class HackathonIngestRequest(BaseModel):
    application_id: str
    code_snapshot: str
    repo_url: Optional[str] = None


class DefenseSubmitRequest(BaseModel):
    candidate_explanation: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/submissions", status_code=status.HTTP_201_CREATED)
async def public_submit_hackathon_snapshot(
    db: DBSession,
    tenant_id: TenantId,
    body: HackathonIngestRequest
):
    """
    Submits candidate multi-file snap code and triggers automated architectural evaluation.
    """
    try:
        sub = await HackathonService.process_project_submission(
            db=db,
            tenant_id=tenant_id,
            application_id=body.application_id,
            code_snapshot=body.code_snapshot,
            repo_url=body.repo_url
        )
        return {
            "submission_id": str(sub.id),
            "status": sub.status,
            "architecture_score": sub.architecture_score
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/defense/{submission_id}")
async def public_get_defense_question(
    db: DBSession,
    tenant_id: TenantId,
    submission_id: str
):
    """
    Returns custom plagiarism check target question based on code snapshot syntax analysis.
    """
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    sub_uuid = uuid.UUID(submission_id) if isinstance(submission_id, str) else submission_id

    stmt = select(CodeDefense).where(
        CodeDefense.tenant_id == t_uuid,
        CodeDefense.submission_id == sub_uuid
    )
    defense = (await db.execute(stmt)).scalar_one_or_none()
    if not defense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Defense context not found. Make sure project snapshot was evaluated."
        )

    return {
        "defense_id": str(defense.id),
        "defense_question": defense.defense_question
    }


@router.post("/defense/{submission_id}/submit")
async def public_submit_code_defense(
    db: DBSession,
    tenant_id: TenantId,
    submission_id: str,
    body: DefenseSubmitRequest
):
    """
    Candidate uploads textual explanation defending original authorship. Triggers threat scoring metrics.
    """
    try:
        defense = await HackathonService.submit_code_defense(
            db=db,
            tenant_id=tenant_id,
            submission_id=submission_id,
            candidate_explanation=body.candidate_explanation
        )
        return {
            "plagiarism_risk": defense.plagiarism_risk,
            "defense_score": defense.defense_score
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
