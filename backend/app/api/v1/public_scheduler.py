"""
Public Calendar Scheduler & Booking Router — Phase 11
Allows candidates to book slots mapped via geographic proximity and skills filters.
Resolved via X-Tenant-Slug headers.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId
from app.models.scheduler import InterviewBooking
from app.services.scheduler import SchedulerService

router = APIRouter(prefix="/public/scheduler", tags=["Public Candidate Scheduling Portal"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BookingRequest(BaseModel):
    application_id: str
    interviewer_id: str
    start_time: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/slots/{application_id}")
async def public_get_available_booking_slots(
    db: DBSession,
    tenant_id: TenantId,
    application_id: str
):
    """
    Returns non-overlapping bookable calendar slots matching geographic distance proximity and skill tag requirements.
    """
    try:
        slots = await SchedulerService.get_available_slots(
            db=db,
            tenant_id=tenant_id,
            application_id=application_id
        )
        return {"slots": slots}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/bookings", status_code=status.HTTP_201_CREATED)
async def public_book_calendar_interview(
    db: DBSession,
    tenant_id: TenantId,
    body: BookingRequest
):
    """
    Locks the calendar time slot and returns the generated meeting join link.
    """
    try:
        booking = await SchedulerService.create_booking(
            db=db,
            tenant_id=tenant_id,
            application_id=body.application_id,
            interviewer_id=body.interviewer_id,
            start_time_iso=body.start_time
        )
        return {
            "booking_id": str(booking.id),
            "start_time": booking.start_time.isoformat(),
            "meeting_link": booking.meeting_link
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
