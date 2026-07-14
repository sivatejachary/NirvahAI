"""
Public Adaptive Interviews Router — Phase 8
Exposes candidate-facing dialog session controllers.
Resolved via X-Tenant-Slug headers.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId
from app.models.interview import Interview, InterviewMessage
from app.services.interview import InterviewService

router = APIRouter(prefix="/public/interviews", tags=["Public Candidate Adaptive Interview"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class InterviewStartRequest(BaseModel):
    application_id: str


class CandidateMessageRequest(BaseModel):
    message_text: str
    audio_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def public_start_interview(
    db: DBSession,
    tenant_id: TenantId,
    body: InterviewStartRequest
):
    """
    Starts an adaptive technical interview session and yields the initial greeting question.
    """
    try:
        interview = await InterviewService.start_interview(
            db=db,
            tenant_id=tenant_id,
            application_id=body.application_id
        )
        
        # Load messages to return the welcome greeting
        from sqlalchemy.orm import selectinload
        stmt = select(Interview).where(Interview.id == interview.id).options(selectinload(Interview.messages))
        loaded = (await db.execute(stmt)).scalar_one()

        return {
            "interview_id": str(loaded.id),
            "status": loaded.status,
            "welcome_message": loaded.messages[0].message_text if len(loaded.messages) > 0 else ""
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{interview_id}/message")
async def public_submit_interview_message(
    db: DBSession,
    tenant_id: TenantId,
    interview_id: str,
    body: CandidateMessageRequest
):
    """
    Processes candidate chat dialogue message and generates follow-ups adaptively using LLM.
    """
    try:
        agent_msg = await InterviewService.process_candidate_message(
            db=db,
            tenant_id=tenant_id,
            interview_id=interview_id,
            message_text=body.message_text,
            audio_url=body.audio_url
        )
        return {
            "sender": agent_msg.sender,
            "message_text": agent_msg.message_text
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{interview_id}/complete")
async def public_complete_interview(
    db: DBSession,
    tenant_id: TenantId,
    interview_id: str
):
    """
    Completes the interview, evaluates grading rubrics, and triggers pipeline changes.
    """
    try:
        interview = await InterviewService.finalize_interview(
            db=db,
            tenant_id=tenant_id,
            interview_id=interview_id
        )
        return {
            "status": interview.status,
            "score": interview.overall_score,
            "report": interview.evaluation_report
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
