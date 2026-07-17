"""
AI Onboarding Agent & Service
Coordinates candidate document collection, welcome kit, IT assets assignment, and orientation checklists.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.onboarding import OnboardingSession
from app.core.logging import get_logger

logger = get_logger(__name__)


class OnboardingService:
    @staticmethod
    async def initiate_onboarding(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        target_joining_date: datetime
    ) -> OnboardingSession:
        """
        Creates onboarding files and triggers IT requests.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        session = OnboardingSession(
            tenant_id=t_uuid,
            application_id=a_uuid,
            status="INITIATED",
            joining_date=target_joining_date,
            onboarding_tasks={
                "it_asset_requested": False,
                "welcome_kit_sent": False,
                "documents_verified": False,
                "orientation_scheduled": False
            }
        )
        db.add(session)
        await db.flush()
        
        logger.info(f"ONBOARDING_INITIATED: Application {application_id} for Joining Date {target_joining_date}")
        return session

    @staticmethod
    async def complete_task(
        db: AsyncSession,
        tenant_id: str,
        session_id: str,
        task_key: str
    ) -> Optional[OnboardingSession]:
        """
        Marks document submission or assets handoff task as completed.
        """
        s_uuid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        
        stmt = select(OnboardingSession).where(
            OnboardingSession.id == s_uuid,
            OnboardingSession.tenant_id == t_uuid
        )
        session = (await db.execute(stmt)).scalar_one_or_none()
        if not session:
            return None
            
        tasks = session.onboarding_tasks or {}
        tasks[task_key] = True
        session.onboarding_tasks = tasks
        
        # If all tasks checked off, mark onboarding completed
        all_completed = all(tasks.get(k) for k in tasks)
        if all_completed:
            session.status = "COMPLETED"
            logger.info(f"ONBOARDING_SESSION_COMPLETED: {session_id}")
            
        await db.flush()
        return session
