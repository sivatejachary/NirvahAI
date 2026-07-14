"""
Assessment Service — Phase 6
Handles adaptive MCQ generations, scoring attempts, proctor telemetry, and candidate grading gates.
"""
import uuid
import json
from typing import Optional, List, Dict, Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import JobMCQ, AssessmentAttempt, ProctoringLog
from app.models.application import Application
from app.models.job import Job
from app.services.llm import LLMGateway
from app.core.logging import get_logger

logger = get_logger(__name__)


class AssessmentService:
    @staticmethod
    async def generate_job_mcq(
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
        topic: str,
        difficulty: str = "MID"
    ) -> JobMCQ:
        """
        Invokes LLM Gateway to generate an MCQ question and saves it to the job question bank.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        j_uuid = uuid.UUID(job_id) if isinstance(job_id, str) else job_id

        # Call Model Gateway with mcq_generation purpose
        raw_res = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="mcq_generate",
            variables={"topic": topic, "difficulty": difficulty},
            purpose="mcq_generation"
        )

        try:
            parsed = json.loads(raw_res)
            # Find correct option string from correct_option_index
            options = parsed.get("options", [])
            idx = parsed.get("correct_option_index", 0)
            correct_val = options[idx] if idx < len(options) else "Unknown"

            mcq = JobMCQ(
                tenant_id=t_uuid,
                job_id=j_uuid,
                question_text=parsed["question_text"],
                options=options,
                correct_option=correct_val,
                difficulty=difficulty
            )
            db.add(mcq)
            await db.flush()
            return mcq
        except Exception as e:
            logger.error(
                "MCQ_GENERATE_PARSING_FAILED",
                job_id=job_id,
                error=str(e),
                raw_response=raw_res
            )
            # Fallback static question if LLM fails
            mcq = JobMCQ(
                tenant_id=t_uuid,
                job_id=j_uuid,
                question_text=f"Explain Linux select() vs poll() under high concurrency.",
                options=["select uses fd_set limit", "poll uses pollfd array", "both have same speed", "poll is slower"],
                correct_option="poll uses pollfd array",
                difficulty=difficulty
            )
            db.add(mcq)
            await db.flush()
            return mcq

    @staticmethod
    async def start_assessment_attempt(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        type: str = "MCQ"
    ) -> AssessmentAttempt:
        """
        Registers a new assessment attempt for the candidate application.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

        # Verify application exists
        app_stmt = select(Application).where(Application.id == a_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if not app:
            raise ValueError(f"Application {application_id} not found.")

        attempt = AssessmentAttempt(
            tenant_id=t_uuid,
            application_id=a_uuid,
            type=type,
            status="STARTED",
            score=None,
            integrity_risk="LOW",
            responses={}
        )
        db.add(attempt)
        await db.flush()
        return attempt

    @staticmethod
    async def get_next_question(
        db: AsyncSession,
        tenant_id: str,
        attempt_id: str
    ) -> Optional[JobMCQ]:
        """
        Returns the next unanswered MCQ question for this attempt.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id

        # Load attempt and application details
        att_stmt = select(AssessmentAttempt).where(AssessmentAttempt.id == att_uuid)
        attempt = (await db.execute(att_stmt)).scalar_one_or_none()
        if not attempt:
            raise ValueError("Assessment attempt not found.")

        app_stmt = select(Application).where(Application.id == attempt.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        
        # Query all MCQ questions for this job
        mcq_stmt = select(JobMCQ).where(JobMCQ.job_id == app.job_id)
        questions = (await db.execute(mcq_stmt)).scalars().all()

        # Find first question that has not been answered in attempt.responses keys
        for q in questions:
            if str(q.id) not in attempt.responses:
                return q

        return None

    @staticmethod
    async def submit_mcq_response(
        db: AsyncSession,
        tenant_id: str,
        attempt_id: str,
        question_id: str,
        candidate_answer: str
    ) -> AssessmentAttempt:
        """
        Submits candidate option choice. If all questions are answered, calculates score and transitions status.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id

        stmt = select(AssessmentAttempt).where(AssessmentAttempt.id == att_uuid)
        attempt = (await db.execute(stmt)).scalar_one_or_none()
        if not attempt:
            raise ValueError("Attempt not found.")

        # Update responses dict (must assign a new copy to trigger SQLAlchemy mutation tracking)
        new_responses = dict(attempt.responses)
        new_responses[str(question_id)] = candidate_answer
        attempt.responses = new_responses

        # Check if all questions are answered
        app_stmt = select(Application).where(Application.id == attempt.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()

        mcq_stmt = select(JobMCQ).where(JobMCQ.job_id == app.job_id)
        questions = (await db.execute(mcq_stmt)).scalars().all()

        # If we have questions and all are answered
        if len(questions) > 0 and all(str(q.id) in new_responses for q in questions):
            correct_count = 0
            for q in questions:
                candidate_val = new_responses.get(str(q.id))
                # Direct string match or match index options mapping
                if candidate_val == q.correct_option:
                    correct_count += 1
                elif candidate_val in q.options and q.options.index(candidate_val) == q.correct_option:
                    correct_count += 1

            attempt.score = (correct_count / len(questions)) * 100
            attempt.status = "COMPLETED"

            # Perform Workflow Auto-Rejection or Next stage promotion triggers
            if attempt.score >= 60:
                app.status = "TECHNICAL_INTERVIEW_STAGE"
            else:
                app.status = "REJECTED"
        
        await db.flush()
        return attempt

    @staticmethod
    async def log_proctoring_telemetry(
        db: AsyncSession,
        tenant_id: str,
        attempt_id: str,
        event_type: str,
        metadata: Optional[dict] = None,
        evidence_reference: Optional[str] = None
    ) -> ProctoringLog:
        """
        Logs integrity proctoring metrics (tab losses, blur counts).
        Evaluates cumulative logs to flag integrity risk levels.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id

        log = ProctoringLog(
            tenant_id=t_uuid,
            assessment_attempt_id=att_uuid,
            event_type=event_type,
            log_metadata=metadata or {},
            evidence_reference=evidence_reference
        )
        db.add(log)
        await db.flush()

        # Recalculate attempt integrity risk based on total flags
        total_stmt = select(func.count(ProctoringLog.id)).where(
            ProctoringLog.assessment_attempt_id == att_uuid
        )
        total_flags = (await db.execute(total_stmt)).scalar() or 0

        # Load attempt
        att_stmt = select(AssessmentAttempt).where(AssessmentAttempt.id == att_uuid)
        attempt = (await db.execute(att_stmt)).scalar_one_or_none()
        if attempt:
            if total_flags >= 5 or event_type == "PASTE_DETECTED":
                attempt.integrity_risk = "HIGH"
            elif total_flags >= 3:
                attempt.integrity_risk = "MEDIUM"
            else:
                attempt.integrity_risk = "LOW"
            await db.flush()

        return log
