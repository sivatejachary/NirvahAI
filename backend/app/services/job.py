"""
Job Recruitment & Sourcing Service
Manages JD generation via LLM, policy compliance audits, and mock multi-channel sourcing distributions.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.tenant import Tenant
from app.services.llm import LLMGateway
from app.services.audit import AuditService
from app.core.logging import get_logger

logger = get_logger(__name__)


class JobService:
    @staticmethod
    async def generate_jd_proposal(
        db: AsyncSession,
        tenant_id: str,
        title: str,
        department_name: str,
        skills: List[str],
        autonomy_level: str
    ) -> Dict[str, Any]:
        """
        Uses the Model Gateway and Prompt Registry to generate a compliant job description.
        """
        # Inject standard placeholder in simulated LLM for testing
        simulated_response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="job_generate",
            variables={
                "title": title,
                "department": department_name,
                "skills": ", ".join(skills),
                "autonomy": autonomy_level
            },
            purpose="job_generation"
        )
        
        try:
            # If simulated response is default mock return, fallback to a structured JD format
            if not simulated_response.startswith("{"):
                return {
                    "title": title,
                    "description": f"# {title}\n## Overview\nRole in {department_name}.\n## Responsibilities\n- Build high agency services.",
                    "requirements": skills
                }
            return json.loads(simulated_response)
        except Exception:
            return {
                "title": title,
                "description": f"Failed to parse model description. Raw: {simulated_response}",
                "requirements": skills
            }

    @staticmethod
    async def create_job_posting(
        db: AsyncSession,
        tenant_id: str,
        title: str,
        description: str,
        department_id: str,
        requirements: List[str],
        created_by: str
    ) -> Job:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        d_uuid = uuid.UUID(department_id) if isinstance(department_id, str) else department_id
        u_uuid = uuid.UUID(created_by) if isinstance(created_by, str) else created_by
        
        job = Job(
            tenant_id=t_uuid,
            department_id=d_uuid,
            title=title,
            description=description,
            requirements=requirements,
            status="DRAFT",
            sourcing_channels={},
            created_by_id=u_uuid
        )
        db.add(job)
        await db.flush()
        
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="job.created",
            actor_type="user",
            actor_id=created_by,
            entity_type="job",
            entity_id=str(job.id),
            reason_code="JOB_CREATION",
            reason_summary=f"Job posting draft created: {title}"
        )
        
        return job

    @staticmethod
    async def get_job(db: AsyncSession, tenant_id: str, job_id: str) -> Optional[Job]:
        stmt = select(Job).where(
            Job.tenant_id == (uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id),
            Job.id == (uuid.UUID(job_id) if isinstance(job_id, str) else job_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def approve_job_posting(
        cls,
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
        user_id: str
    ) -> Optional[Job]:
        job = await cls.get_job(db, tenant_id, job_id)
        if not job:
            return None
            
        job.status = "APPROVED"
        job.updated_at = datetime.now(timezone.utc)
        await db.flush()
        
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="job.approved",
            actor_type="user",
            actor_id=user_id,
            entity_type="job",
            entity_id=str(job.id),
            reason_code="JOB_APPROVAL",
            reason_summary=f"Job posting approved for distribution: {job.title}"
        )
        return job

    @classmethod
    async def publish_and_distribute(
        cls,
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
        channels: List[str],
        user_id: str
    ) -> Optional[Job]:
        job = await cls.get_job(db, tenant_id, job_id)
        if not job:
            return None
            
        if job.status not in ("APPROVED", "DRAFT"):
            raise ValueError("Job must be in DRAFT or APPROVED status before publishing.")
            
        # Get tenant slug for referral URLs
        tenant_stmt = select(Tenant).where(Tenant.id == job.tenant_id)
        tenant = (await db.execute(tenant_stmt)).scalar_one()
        
        # Simulate API sourcing distribution
        channels_state = {}
        for chan in channels:
            # Create a unique referral tracker URL for this sourcing channel
            referral_url = f"http://localhost:3000/portal?tenant={tenant.company_slug}&job={job.id}&channel={chan}"
            channels_state[chan] = {
                "status": "PUBLISHED",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "referral_url": referral_url
            }
            
        job.sourcing_channels = channels_state
        job.status = "PUBLISHED"
        job.updated_at = datetime.now(timezone.utc)
        await db.flush()
        
        # Publish job.published event via Integration Service Event Bus
        from app.services.integration_event import EventBusService, EventCatalog
        await EventBusService.publish_event(
            event_type=EventCatalog.JOB_PUBLISHED,
            company_id=str(tenant_id),
            job_id=str(job.id),
            payload={
                "job_id": str(job.id),
                "title": job.title,
                "description": job.description,
                "requirements": job.requirements,
                "status": job.status,
                "sourcing_channels": channels_state
            }
        )
        return job

    @classmethod
    async def delete_job_posting(
        cls,
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
        user_id: str
    ) -> bool:
        job = await cls.get_job(db, tenant_id, job_id)
        if not job:
            return False
            
        await db.delete(job)
        await db.flush()
        
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="job.deleted",
            actor_type="user",
            actor_id=user_id,
            entity_type="job",
            entity_id=job_id,
            reason_code="JOB_DELETION",
            reason_summary=f"Job posting deleted: {job_id}"
        )
        
        from app.services.integration_event import EventBusService, EventCatalog
        try:
            await EventBusService.publish_event(
                event_type=EventCatalog.JOB_DELETED,
                company_id=tenant_id,
                job_id=str(job_id),
                payload={"job_id": str(job_id)}
            )
        except Exception as e:
            logger.warning("VIDYAMARGAI_JOB_EVENT_DELETE_FAILED", error=str(e))
            
        return True
