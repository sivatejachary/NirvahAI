"""
Job Applications & Resume Grading Service
Manages blind extraction, GDPR consent gating, and LLM rank matching pipeline.
"""
import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.job import Job
from app.models.compliance import ComplianceProfile, ConsentRecord
from app.services.llm import LLMGateway
from app.services.workflows import WorkflowService
from app.services.audit import AuditService
from app.core.logging import get_logger

logger = get_logger(__name__)


class ApplicationService:
    @staticmethod
    async def get_application(
        db: AsyncSession,
        tenant_id: str,
        application_id: str
    ) -> Optional[Application]:
        stmt = select(Application).where(
            Application.tenant_id == (uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id),
            Application.id == (uuid.UUID(application_id) if isinstance(application_id, str) else application_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def submit_application(
        cls,
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
        candidate_name: str,
        candidate_email: str,
        resume_text: str,
        resume_url: Optional[str] = None
    ) -> Application:
        """
        Ingests a job application. Enforces consent checks, executes blind parsing,
        performs rank-matching, and registers workflow pipelines.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        j_uuid = uuid.UUID(job_id) if isinstance(job_id, str) else job_id
        
        candidate_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, candidate_email)
        
        # 1. Enforce GDPR Consent Gating if enabled
        profile_stmt = select(ComplianceProfile).where(ComplianceProfile.tenant_id == t_uuid)
        profile = (await db.execute(profile_stmt)).scalar_one_or_none()
        
        # Enforce if profile is configured for strict consent (default is true if profile is not set up)
        strict_consent = profile.strict_consent_required if profile else True
        if strict_consent:
            consent_stmt = select(ConsentRecord).where(
                ConsentRecord.tenant_id == t_uuid,
                ConsentRecord.candidate_id == candidate_uuid,
                ConsentRecord.consent_status == True
            )
            consent = (await db.execute(consent_stmt)).scalars().first()
            if not consent:
                raise ValueError("Strict candidate consent check failed. Applicant has not signed AI consent form.")
                
        # 2. Extract demographics-blind resume profile via LLM Gateway
        parsed_res = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="resume_parse",
            variables={"resume_text": resume_text},
            purpose="resume_parsing"
        )
        
        try:
            profile_data = json.loads(parsed_res)
        except Exception:
            profile_data = {"skills": [], "experience_years": 0.0}
            
        # 3. Load Job details for matching
        stmt = select(Job).where(Job.tenant_id == t_uuid, Job.id == j_uuid)
        job = (await db.execute(stmt)).scalar_one_or_none()
        if not job:
            raise ValueError("Target job posting does not exist under this tenant.")
            
        # 4. Grade Candidate Fit via Gateway Matcher
        match_res = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="candidate_match",
            variables={
                "job_requirements": ", ".join(job.requirements or []),
                "candidate_profile": json.dumps(profile_data)
            },
            purpose="candidate_matching"
        )
        
        try:
            match_data = json.loads(match_res)
            fit_score = float(match_data.get("fit_score", 50.0))
            reasoning = match_data.get("reasoning", "Parsed match result.")
            initial_status = match_data.get("status", "MCQ_STAGE")
        except Exception:
            fit_score = 50.0
            reasoning = "Failed to parse grade results. Defaulted to fallback scoring."
            initial_status = "MCQ_STAGE"
            
        # 5. Create Application entry
        application = Application(
            tenant_id=t_uuid,
            job_id=j_uuid,
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            resume_url=resume_url or "s3://hros/resumes/raw.pdf",
            status=initial_status,
            raw_parsed_data=profile_data,
            fit_score=fit_score,
            screening_feedback=reasoning
        )
        db.add(application)
        await db.flush()
        
        # 6. Start Recruitment Workflow Instance tracker (Temporal Mock)
        await WorkflowService.start_recruitment_workflow(
            db=db,
            tenant_id=tenant_id,
            application_id=str(application.id),
            initial_state={
                "fit_score": fit_score,
                "history": [f"application ingested. fit score graded: {fit_score}"]
            }
        )
        
        # 7. Audit log the application
        audit = AuditService(db)
        await audit.log(
            tenant_id=tenant_id,
            action="application.submitted",
            actor_type="candidate",
            actor_id=str(candidate_uuid),
            entity_type="application",
            entity_id=str(application.id),
            reason_code="APPLICATION_SUBMISSION",
            reason_summary=f"Ingested application from {candidate_name} with fit score {fit_score}."
        )
        
        # 8. Initialize the 15-stage pipeline
        from app.services.pipeline import PipelineService
        await PipelineService.initialize_pipeline(
            db=db,
            tenant_id=tenant_id,
            application_id=str(application.id)
        )
        
        return application
