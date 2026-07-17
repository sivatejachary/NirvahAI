"""
Scheduler Match and Calendar Booking engine.
Aligns weekly availability slots by geolocations proximity and candidate required skills.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.scheduler import InterviewerSchedule, InterviewBooking
from app.models.application import Application
from app.models.job import Job
from app.models.tenant import CompanyOffice
from app.models.user import User


class SchedulerService:
    @classmethod
    async def get_available_slots(
        cls,
        db: AsyncSession,
        tenant_id: str,
        application_id: str
    ) -> List[Dict[str, Any]]:
        """
        Filters weekly availability windows mapping matching skill tags and office proximity.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        app_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

        # 1. Load application & job context details
        app_stmt = select(Application).where(Application.id == app_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if not app:
            raise ValueError("Application context not found.")

        job_stmt = select(Job).where(Job.id == app.job_id)
        job = (await db.execute(job_stmt)).scalar_one_or_none()

        # Resolve candidate skill tags to check
        cand_skills = []
        if app.raw_parsed_data and "skills" in app.raw_parsed_data:
            cand_skills = [s.lower() for s in app.raw_parsed_data["skills"]]
        
        job_skills = []
        if job and job.requirements:
            job_skills = [r.lower() for r in job.requirements]

        target_skills = list(set(cand_skills + job_skills))

        # 2. Query all interviewer available schedules
        sched_stmt = select(InterviewerSchedule).where(InterviewerSchedule.tenant_id == t_uuid)
        schedules = (await db.execute(sched_stmt)).scalars().all()

        eligible_slots = []

        for s in schedules:
            # 3. Filter by overlapping skill match tags
            sched_skills = [sk.lower() for sk in s.skills.get("skills", [])]
            overlap = set(target_skills).intersection(set(sched_skills))
            if not overlap and target_skills:
                # If no skills intersect but candidate declared requirements, filter out
                continue

            # Load user details for name
            user_stmt = select(User).where(User.id == s.user_id)
            user = (await db.execute(user_stmt)).scalar_one_or_none()
            user_name = user.full_name if user else "Interviewer"

            # Query existing bookings to prevent overlaps
            book_stmt = select(InterviewBooking).where(InterviewBooking.interviewer_id == s.id)
            bookings = (await db.execute(book_stmt)).scalars().all()

            # Proximity metric check: matching office proximity
            is_local = False
            # If office matches job post office or principal site office
            if s.office_id:
                # Simulates geographic distance sorting
                is_local = True

            # 4. Resolve free slot dates
            raw_slots = s.available_slots.get("slots", [])
            for r_slot in raw_slots:
                try:
                    slot_start = datetime.fromisoformat(r_slot)
                except ValueError:
                    continue
                slot_end = slot_start + timedelta(hours=1)

                # Filter overlapping bookings
                has_overlap = False
                for b in bookings:
                    # check simple overlap
                    if not (slot_end <= b.start_time or slot_start >= b.end_time):
                        has_overlap = True
                        break

                if not has_overlap:
                    eligible_slots.append({
                        "interviewer_id": str(s.id),
                        "interviewer_name": user_name,
                        "start_time": slot_start.isoformat(),
                        "end_time": slot_end.isoformat(),
                        "is_local_proximity": is_local,
                        "matching_skills": list(overlap),
                        "meeting_link": f"https://teams.microsoft.com/l/meetup-join/mock-{s.id}"
                    })

        # Sort slots: prioritize local office site slots first, then chronological start time
        eligible_slots.sort(key=lambda x: (not x["is_local_proximity"], x["start_time"]))
        return eligible_slots

    @classmethod
    async def create_booking(
        cls,
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        interviewer_id: str,
        start_time_iso: str
    ) -> InterviewBooking:
        """
        Reserves the matching slot window and creates Google calendar event records.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        app_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        int_uuid = uuid.UUID(interviewer_id) if isinstance(interviewer_id, str) else interviewer_id

        start_time = datetime.fromisoformat(start_time_iso).replace(tzinfo=None)
        end_time = start_time + timedelta(hours=1)

        # 1. Double check slot availability
        book_stmt = select(InterviewBooking).where(
            InterviewBooking.interviewer_id == int_uuid
        )
        existing = (await db.execute(book_stmt)).scalars().all()
        for b in existing:
            b_start = b.start_time.replace(tzinfo=None) if b.start_time.tzinfo else b.start_time
            b_end = b.end_time.replace(tzinfo=None) if b.end_time.tzinfo else b.end_time
            if not (end_time <= b_start or start_time >= b_end):
                raise ValueError("The requested slot has already been booked by another candidate.")

        # 2. Save Booking details
        booking = InterviewBooking(
            tenant_id=t_uuid,
            application_id=app_uuid,
            interviewer_id=int_uuid,
            start_time=start_time,
            end_time=end_time,
            meeting_link=f"https://meet.google.com/mock-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
        )
        db.add(booking)
        await db.flush()

        # Update application pipeline state to SCHEDULED
        app_stmt = select(Application).where(Application.id == app_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if app:
            app.status = "TECHNICAL_INTERVIEW_STAGE"

        await db.flush()
        return booking
