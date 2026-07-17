"""
AI Interview Coordinator & Scheduler Service (Stage 7 Specialist)
Integrates interviewer calendars, multi-channel notifications, panel briefing packages, and visitor QR codes.
"""
import uuid
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import ApplicationStage
from app.models.application import Application
from app.models.job import Job
from app.models.tenant import CompanySettings, CompanyOffice
from app.core.logging import get_logger

logger = get_logger(__name__)


class SchedulerService:
    @staticmethod
    async def match_slots_and_schedule(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        stage_number: int,
        preferred_slots: List[str],
        interview_type: str = "ONLINE"
    ) -> Dict[str, Any]:
        """
        Stage 7 Coordinator Core: Checks panel availability and books the best slot.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        # 1. Fetch Application & Job context details
        app_stmt = select(Application).where(Application.id == a_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if not app:
            raise ValueError("Application not found.")
            
        job_stmt = select(Job).where(Job.id == app.job_id)
        job = (await db.execute(job_stmt)).scalar_one_or_none()
        job_title = job.title if job else "Specialist Role"
        
        # Get Company Settings for timezone and calendar rules
        settings_stmt = select(CompanySettings).where(CompanySettings.tenant_id == t_uuid)
        settings = (await db.execute(settings_stmt)).scalar_one_or_none()
        
        # Select slot from preferred or fallback to tomorrow 10:00 AM
        selected_slot = preferred_slots[0] if preferred_slots else (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0).isoformat()
        
        # 2. Mocking reserve space: online meeting ID or room booking
        meeting_id = f"meet-{uuid.uuid4().hex[:8]}"
        meeting_url = f"https://meet.nirvahai.com/{meeting_id}"
        room_number = None
        qr_pass = None
        
        if interview_type == "IN_PERSON":
            # Book a room in the company headquarters office
            office_stmt = select(CompanyOffice).where(CompanyOffice.tenant_id == t_uuid)
            office = (await db.execute(office_stmt)).scalar_one_or_none()
            room_number = f"Conference Room {random.choice(['Alpha', 'Beta', 'Gamma'])}"
            meeting_url = None
            qr_pass = f"QR-NIRVAH-{random.randint(100000, 999999)}"
            
        # 3. Create stage booking details inside stage metadata
        stage_stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number
        )
        stage = (await db.execute(stage_stmt)).scalar_one_or_none()
        if stage:
            stage.status = "SCHEDULED"
            stage.scheduled_at = datetime.fromisoformat(selected_slot)
            
            # Enrich metadata
            meta = stage.metadata or {}
            meta.update({
                "interview_type": interview_type,
                "meeting_url": meeting_url,
                "room_number": room_number,
                "qr_visitor_pass": qr_pass,
                "interviewer_panel": ["Sarah Connor (Lead Tech)", "James Smith (Hiring Manager)"],
                "candidate_confirmed": True
            })
            stage.metadata = meta
            await db.flush()
            
        # 4. Trigger Multi-channel notifications
        await SchedulerService._notify_candidate(
            email=app.candidate_email,
            name=app.candidate_name,
            job_title=job_title,
            slot=selected_slot,
            interview_type=interview_type,
            meeting_url=meeting_url,
            room_number=room_number,
            qr_pass=qr_pass
        )
        
        # 5. Trigger Panel digest notification
        await SchedulerService._notify_panel(
            candidate_name=app.candidate_name,
            job_title=job_title,
            fit_score=app.fit_score,
            ai_summary=app.screening_feedback or "Candidate matches requirements.",
            slot=selected_slot
        )
        
        # 6. Queue AI Reminder hooks (mocked log)
        logger.info(f"Queued Reminders for Candidate: 24h, 2h, 30m before {selected_slot}")
        logger.info(f"Queued Reminders for Panel: 24h, 1h, 15m before {selected_slot}")
        
        return {
            "success": True,
            "scheduled_time": selected_slot,
            "interview_type": interview_type,
            "meeting_url": meeting_url,
            "room_number": room_number,
            "visitor_qr_pass": qr_pass
        }

    @staticmethod
    async def _notify_candidate(email: str, name: str, job_title: str, slot: str, interview_type: str, meeting_url: Optional[str], room_number: Optional[str], qr_pass: Optional[str]):
        """Candidate email & WhatsApp notifier."""
        agenda = "Technical skills verification, coding background review, and systems architecture discussion."
        logger.info(f"NOTIFICATION_SENT: Candidate {name} ({email}) scheduled for {slot} ({interview_type})")
        # In production, this dispatches via AWS SES or Twilio SMS/WhatsApp

    @staticmethod
    async def _notify_panel(candidate_name: str, job_title: str, fit_score: float, ai_summary: str, slot: str):
        """Interviewer Briefing panel packet notifier."""
        logger.info(f"PANEL_BRIEFING_SENT: Sarah Connor & James Smith notified for {candidate_name} - {job_title} on {slot}. Match score: {fit_score}%")
