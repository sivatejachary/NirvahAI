"""
Public Recruiter Phone Dialer Router — Phase 10
Allows candidates to trigger outbound recruiting calls and exchange dialog stream memory.
Resolved via X-Tenant-Slug headers.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId
from app.models.recruiter_call import RecruiterCall, CallMessage
from app.services.recruiter_call import RecruiterCallService

router = APIRouter(prefix="/public/calls", tags=["Public Candidate Outbound Dialer"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CallStartRequest(BaseModel):
    application_id: str


class CallStreamRequest(BaseModel):
    message_text: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def public_start_recruiter_call(
    db: DBSession,
    tenant_id: TenantId,
    body: CallStartRequest
):
    """
    Candidate triggers outbound recruiting call dialog. Sets CONNECTED and yields mandatory AI disclosure.
    """
    try:
        call = await RecruiterCallService.start_call(
            db=db,
            tenant_id=tenant_id,
            application_id=body.application_id
        )
        
        # Load messages to return welcome greeting
        from sqlalchemy.orm import selectinload
        stmt = select(RecruiterCall).where(RecruiterCall.id == call.id).options(selectinload(RecruiterCall.messages))
        loaded = (await db.execute(stmt)).scalar_one()

        return {
            "call_id": str(loaded.id),
            "status": loaded.status,
            "greeting_message": loaded.messages[0].message_text if len(loaded.messages) > 0 else ""
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{call_id}/stream")
async def public_stream_recruiter_call(
    db: DBSession,
    tenant_id: TenantId,
    call_id: str,
    body: CallStreamRequest
):
    """
    Processes candidate spoken dialogue response and generates adaptive follow-up recruiting agent probe.
    """
    try:
        agent_msg = await RecruiterCallService.stream_candidate_chunk(
            db=db,
            tenant_id=tenant_id,
            call_id=call_id,
            message_text=body.message_text
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


@router.post("/{call_id}/disconnect")
async def public_disconnect_recruiter_call(
    db: DBSession,
    tenant_id: TenantId,
    call_id: str
):
    """
    Disconnects call dialogue session and generates overall conversation summaries.
    """
    try:
        call = await RecruiterCallService.disconnect_call(
            db=db,
            tenant_id=tenant_id,
            call_id=call_id
        )
        return {
            "status": call.status,
            "duration_seconds": call.call_duration,
            "summary": call.summary,
            "recording_url": call.recording_url
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
