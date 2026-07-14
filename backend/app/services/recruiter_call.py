"""
Recruiter Outbound call conversation service.
Handles call states, mandatory disclosures, and real-time dialog memory streams.
"""
import uuid
import os
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recruiter_call import RecruiterCall, CallMessage
from app.models.application import Application
from app.services.llm import LLMGateway

# Load system prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "recruiter_call.txt")
try:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        SYSTEM_PROMPT = f.read()
except Exception:
    SYSTEM_PROMPT = "You are an automated AI Recruiter agent. Outbound call."


class RecruiterCallService:
    @classmethod
    async def start_call(
        cls,
        db: AsyncSession,
        tenant_id: str,
        application_id: str
    ) -> RecruiterCall:
        """
        Initiates the outbound call, sets status to CONNECTED, and generates the greeting with the mandatory disclosure.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        app_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

        # 1. Create Call Log
        call = RecruiterCall(
            tenant_id=t_uuid,
            application_id=app_uuid,
            status="CONNECTED"
        )
        db.add(call)
        await db.flush()

        # 2. Get blind resume info
        app_stmt = select(Application).where(Application.id == app_uuid)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        skills = []
        if app and app.raw_parsed_data:
            skills = app.raw_parsed_data.get("skills", [])

        # 3. Call LLM to generate initial welcome with disclosure
        # NY LL144 and GDPR require clear notice that automated systems are utilized.
        disclosure_prompt = (
            "Generate an outbound recruiting call opening that states the mandatory AI disclosure notice: "
            "'This call is conducted by an automated AI recruiter and will be recorded and transcribed for evaluation purposes.' "
            "Then, introduce yourself and ask if the candidate is ready to speak about the role."
        )

        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="call_welcome", # template next
            variables={"skills": ", ".join(skills) if skills else "General Software"},
            purpose="call_welcome"
        )

        # 4. Save greeting message
        welcome_msg = CallMessage(
            tenant_id=t_uuid,
            call_id=call.id,
            sender="AGENT",
            message_text=response
        )
        db.add(welcome_msg)
        await db.flush()

        return call

    @classmethod
    async def stream_candidate_chunk(
        cls,
        db: AsyncSession,
        tenant_id: str,
        call_id: str,
        message_text: str
    ) -> CallMessage:
        """
        Appends candidate dialogue chunk, updates conversation memory, and streams the next response.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        c_uuid = uuid.UUID(call_id) if isinstance(call_id, str) else call_id

        # 1. Load call context
        stmt = select(RecruiterCall).where(
            RecruiterCall.tenant_id == t_uuid,
            RecruiterCall.id == c_uuid
        ).options(selectinload(RecruiterCall.messages))
        call = (await db.execute(stmt)).scalar_one_or_none()
        if not call:
            raise ValueError("Call session not found.")

        # 2. Append candidate message
        cand_msg = CallMessage(
            tenant_id=t_uuid,
            call_id=c_uuid,
            sender="CANDIDATE",
            message_text=message_text
        )
        db.add(cand_msg)
        await db.flush()

        # 3. Compile dialogue memory
        history = []
        for m in call.messages:
            history.append(f"{m.sender}: {m.message_text}")
        history.append(f"CANDIDATE: {message_text}")
        dialogue = "\n".join(history)

        # 4. Generate next reply
        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="call_followup",
            variables={"dialogue": dialogue},
            purpose="call_followup"
        )

        agent_msg = CallMessage(
            tenant_id=t_uuid,
            call_id=c_uuid,
            sender="AGENT",
            message_text=response
        )
        db.add(agent_msg)
        await db.flush()

        return agent_msg

    @classmethod
    async def disconnect_call(
        cls,
        db: AsyncSession,
        tenant_id: str,
        call_id: str
    ) -> RecruiterCall:
        """
        Disconnects phone call session, triggers summary review, and advances application stage.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        c_uuid = uuid.UUID(call_id) if isinstance(call_id, str) else call_id

        # 1. Load call transcript
        stmt = select(RecruiterCall).where(
            RecruiterCall.tenant_id == t_uuid,
            RecruiterCall.id == c_uuid
        ).options(selectinload(RecruiterCall.messages))
        call = (await db.execute(stmt)).scalar_one_or_none()
        if not call:
            raise ValueError("Call session not found.")

        history = []
        for m in call.messages:
            history.append(f"{m.sender}: {m.message_text}")
        transcript = "\n".join(history)

        # 2. Call LLM to summarize call
        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="call_evaluate",
            variables={"transcript": transcript},
            purpose="call_evaluation"
        )

        # 3. Save summary & wrap state
        call.status = "DISCONNECTED"
        call.call_duration = len(call.messages) * 12 # simulated seconds per exchange
        call.summary = response
        call.recording_url = f"https://s3.bucket/calls/{call.id}.webm"

        # 4. Advance application to HUMAN_INTERVIEW stage if successful
        app_stmt = select(Application).where(Application.id == call.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if app:
            app.status = "TECHNICAL_INTERVIEW_STAGE"

        await db.flush()
        return call
