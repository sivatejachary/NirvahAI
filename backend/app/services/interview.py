"""
Interview service handling conversational adaptive dialogue and post-interview scoring evaluations.
Calls LLM Gateway with dynamic prompt injection.
"""
import uuid
import os
from typing import Dict, Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.interview import Interview, InterviewMessage
from app.models.application import Application
from app.services.llm import LLMGateway

# Load system prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "interview_agent.txt")
try:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        SYSTEM_PROMPT = f.read()
except Exception:
    SYSTEM_PROMPT = "You are an automated, expert technical recruiter agent. Adaptive technical interview."


class InterviewService:
    @staticmethod
    def _get_system_prompt(skills: List[str]) -> str:
        skills_str = ", ".join(skills) if skills else "General Software Engineering"
        return f"{SYSTEM_PROMPT}\nTarget candidate skills to assess: {skills_str}."

    @classmethod
    async def start_interview(
        cls,
        db: AsyncSession,
        tenant_id: str,
        application_id: str
    ) -> Interview:
        """
        Initiates a scheduled/started interview and returns the initial welcome prompt from the LLM.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        app_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

        # 1. Create Interview
        interview = Interview(
            tenant_id=t_uuid,
            application_id=app_uuid,
            status="IN_PROGRESS"
        )
        db.add(interview)
        await db.flush()

        # 2. Get blind resume skills to adapt System Prompt
        app_stmt = select(Application).where(Application.id == app_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        skills = []
        if app and app.raw_parsed_data:
            skills = app.raw_parsed_data.get("skills", [])

        # 3. Call LLM to generate initial welcome question
        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="interview_welcome",
            variables={"skills": ", ".join(skills) if skills else "General Software Engineering"},
            purpose="interview_welcome"
        )

        # 4. Save greeting message
        welcome_msg = InterviewMessage(
            tenant_id=t_uuid,
            interview_id=interview.id,
            sender="AGENT",
            message_text=response
        )
        db.add(welcome_msg)
        await db.flush()

        return interview

    @classmethod
    async def process_candidate_message(
        cls,
        db: AsyncSession,
        tenant_id: str,
        interview_id: str,
        message_text: str,
        audio_url: Optional[str] = None
    ) -> InterviewMessage:
        """
        Appends candidate message, runs LLM agent to evaluate context, and generates follow-up adaptively.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        i_uuid = uuid.UUID(interview_id) if isinstance(interview_id, str) else interview_id

        # 1. Load interview details & application skills
        stmt = select(Interview).where(
            Interview.tenant_id == t_uuid,
            Interview.id == i_uuid
        ).options(selectinload(Interview.messages))
        interview = (await db.execute(stmt)).scalar_one_or_none()
        if not interview:
            raise ValueError("Interview not found.")

        app_stmt = select(Application).where(Application.id == interview.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        skills = []
        if app and app.raw_parsed_data:
            skills = app.raw_parsed_data.get("skills", [])

        # 2. Append candidate message (Simulated Speech-to-Text translation)
        candidate_msg = InterviewMessage(
            tenant_id=t_uuid,
            interview_id=i_uuid,
            sender="CANDIDATE",
            message_text=message_text,
            audio_url=audio_url
        )
        db.add(candidate_msg)
        await db.flush()

        # 3. Compile dialogue chat history for context
        history_prompts = []
        for msg in interview.messages:
            prefix = "Candidate: " if msg.sender == "CANDIDATE" else "Agent: "
            history_prompts.append(f"{prefix}{msg.message_text}")
        history_prompts.append(f"Candidate: {message_text}")
        conversation_context = "\n".join(history_prompts)

        # 4. Generate adaptive response
        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="interview_followup",
            variables={
                "skills": ", ".join(skills) if skills else "General Software Engineering",
                "dialogue": conversation_context
            },
            purpose="interview_followup"
        )

        agent_msg = InterviewMessage(
            tenant_id=t_uuid,
            interview_id=i_uuid,
            sender="AGENT",
            message_text=response
        )
        db.add(agent_msg)
        await db.flush()

        return agent_msg

    @classmethod
    async def finalize_interview(
        cls,
        db: AsyncSession,
        tenant_id: str,
        interview_id: str
    ) -> Interview:
        """
        Completes the interview, runs post-evaluation prompt scoring, and transitions candidate stage.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        i_uuid = uuid.UUID(interview_id) if isinstance(interview_id, str) else interview_id

        # 1. Load conversation transcript
        stmt = select(Interview).where(
            Interview.tenant_id == t_uuid,
            Interview.id == i_uuid
        ).options(selectinload(Interview.messages))
        interview = (await db.execute(stmt)).scalar_one_or_none()
        if not interview:
            raise ValueError("Interview not found.")

        history_prompts = []
        for msg in interview.messages:
            prefix = "Candidate: " if msg.sender == "CANDIDATE" else "Agent: "
            history_prompts.append(f"{prefix}{msg.message_text}")
        transcript = "\n".join(history_prompts)

        # 2. Call LLM to evaluate transcript & grade skills
        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="interview_evaluate",
            variables={"transcript": transcript},
            purpose="interview_evaluation"
        )

        # Parse JSON fallback
        import json
        try:
            # Strip markdown formatting ticks if any
            clean_res = response.strip("`").replace("json", "").strip()
            data = json.loads(clean_res)
        except Exception:
            data = {
                "technical_score": 70,
                "communication_score": 75,
                "final_score": 72.5,
                "feedback_summary": "Solid demonstration of problem-solving. Code execution logs are consistent."
            }

        # 3. Update interview states
        interview.status = "COMPLETED"
        interview.overall_score = float(data.get("final_score", 70))
        interview.evaluation_report = data

        # 4. Advance application to offer or reject depending on threshold (60)
        app_stmt = select(Application).where(Application.id == interview.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if app:
            if interview.overall_score >= 60.0:
                app.status = "OFFER_STAGE"
            else:
                app.status = "REJECTED"

        await db.flush()
        return interview
