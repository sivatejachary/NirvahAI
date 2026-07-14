"""
Meeting Intelligence API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.meeting import Meeting

router = APIRouter(prefix="/meetings", tags=["Meeting Intelligence"])


class CreateMeetingRequest(BaseModel):
    title: str
    meeting_date: datetime
    attendees: List[str]  # list of email strings
    transcript: Optional[str] = None
    duration_minutes: Optional[int] = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_meeting(
    body: CreateMeetingRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    meeting = Meeting(
        title=body.title,
        meeting_date=body.meeting_date,
        attendees=body.attendees,
        transcript=body.transcript,
        duration_minutes=body.duration_minutes,
        status="PENDING_SUMMARY",
        tenant_id=tid,
    )
    db.add(meeting)
    await db.flush()
    return meeting


@router.get("")
async def get_meetings(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Meeting).where(Meeting.tenant_id == tid).order_by(Meeting.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Meeting).where(Meeting.id == meeting_id, Meeting.tenant_id == tid)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/{meeting_id}/summarize")
async def summarize_meeting(
    meeting_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hiring_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Meeting).where(Meeting.id == meeting_id, Meeting.tenant_id == tid)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    transcript = meeting.transcript or "Empty meeting transcript."
    
    # Generate mock AI summary and action items
    summary_text = transcript[:300] + "... [AI Summary: In this meeting, key operational updates were discussed, goals aligned, and responsibilities assigned for the project milestones.]"
    action_items = [
        {"item": "Follow up on operational goals", "owner": "Project Lead", "due": "Next meeting"},
        {"item": "Distribute summary to team members", "owner": "Organizer", "due": "24 hours"},
        {"item": "Schedule follow up review", "owner": "TBD", "due": "End of week"}
    ]
    
    meeting.summary = summary_text
    meeting.action_items = action_items
    meeting.status = "SUMMARIZED"
    
    await db.flush()
    return meeting
