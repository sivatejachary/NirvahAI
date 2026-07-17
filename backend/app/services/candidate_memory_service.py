"""
Candidate Long-term Memory Service
Aggregates and tracks candidate attempts, past assessments feedback, and weakness trends.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.pipeline import ApplicationStage
from app.core.logging import get_logger

logger = get_logger(__name__)


class CandidateMemoryService:
    @staticmethod
    async def retrieve_candidate_history(
        db: AsyncSession,
        tenant_id: str,
        candidate_email: str
    ) -> Dict[str, Any]:
        """
        Gathers past screening fits, comments, and weaknesses logs for a candidate.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        
        # 1. Query past applications
        app_stmt = select(Application).where(
            Application.tenant_id == t_uuid,
            Application.candidate_email == candidate_email
        )
        apps = (await db.execute(app_stmt)).scalars().all()
        app_ids = [a.id for a in apps]
        
        # 2. Gather failed attempts and feedback
        feedback_list = []
        weakness_keywords = set()
        
        if app_ids:
            stage_stmt = select(ApplicationStage).where(
                ApplicationStage.application_id.in_(app_ids)
            )
            stages = (await db.execute(stage_stmt)).scalars().all()
            for s in stages:
                if s.feedback:
                    feedback_list.append(s.feedback)
                    # Extract quick simulated weaknesses terms
                    for word in ["python", "react", "database", "scale", "concurrency", "communication"]:
                        if word in s.feedback.lower():
                            weakness_keywords.add(word)
                            
        return {
            "candidate_email": candidate_email,
            "total_applications": len(apps),
            "past_feedbacks": feedback_list,
            "detected_weaknesses": list(weakness_keywords),
            "memory_compiled_at": datetime.now(timezone.utc).isoformat()
        }
