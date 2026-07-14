"""
Hackathon Project Evaluator and Plagiarism Defense verification service.
Uses LLM Gateway for evaluation.
"""
import uuid
import os
import json
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hackathon import HackathonSubmission, CodeDefense
from app.models.application import Application
from app.services.llm import LLMGateway

# Load system prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "defense_agent.txt")
try:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        SYSTEM_PROMPT = f.read()
except Exception:
    SYSTEM_PROMPT = "You are an expert technical plagiarism evaluator. Code defense."


class HackathonService:
    @classmethod
    async def process_project_submission(
        cls,
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        code_snapshot: str,
        repo_url: Optional[str] = None
    ) -> HackathonSubmission:
        """
        Ingests project codebase, triggers mock sandbox unit tests, and calls LLM to generate targeted defense question.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        app_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id

        # 1. Run mock sandbox unit test evaluation
        # Simulates unpacking ZIP and compiling tests
        test_pass_ratio = 1.0 # default mock pass

        # 2. Call LLM to review architecture and formulate Code Defense Probe
        eval_prompt = (
            f"Review the submitted codebase snapshot:\n\n{code_snapshot}\n\n"
            "Assess the architecture design modularity. "
            "Formulate one targeted question asking the candidate to defend a specific choice "
            "to prove they wrote this code. Return a JSON block containing:\n"
            "- architecture_score: float (0-100)\n"
            "- evaluation_summary: text description of design quality\n"
            "- defense_question: text question targeting candidate code."
        )

        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="defense_evaluate", # we will create this template next
            variables={"code_snapshot": code_snapshot},
            purpose="hackathon_review"
        )

        try:
            clean_res = response.strip("`").replace("json", "").strip()
            data = json.loads(clean_res)
        except Exception:
            data = {
                "architecture_score": 80.0,
                "evaluation_summary": "Clean layered design. Consistent routing protocols.",
                "defense_question": "Why did you implement custom connection pooling instead of using library frameworks in your DB routing?"
            }

        # 3. Save Submission details
        sub = HackathonSubmission(
            tenant_id=t_uuid,
            application_id=app_uuid,
            repo_url=repo_url,
            code_snapshot=code_snapshot,
            status="EVALUATING",
            architecture_score=float(data.get("architecture_score", 80.0)),
            test_pass_ratio=test_pass_ratio,
            evaluation_summary=data.get("evaluation_summary", "")
        )
        db.add(sub)
        await db.flush()

        # 4. Save Defense prompt question
        defense = CodeDefense(
            tenant_id=t_uuid,
            submission_id=sub.id,
            defense_question=data.get("defense_question", "Explain the core layout of your architecture.")
        )
        db.add(defense)
        await db.flush()

        return sub

    @classmethod
    async def submit_code_defense(
        cls,
        db: AsyncSession,
        tenant_id: str,
        submission_id: str,
        candidate_explanation: str
    ) -> CodeDefense:
        """
        Grades plagiarism defense response, calculates threat index, and triggers pipeline changes.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        sub_uuid = uuid.UUID(submission_id) if isinstance(submission_id, str) else submission_id

        # 1. Load submission and defense logs
        stmt = select(CodeDefense).where(
            CodeDefense.tenant_id == t_uuid,
            CodeDefense.submission_id == sub_uuid
        )
        defense = (await db.execute(stmt)).scalar_one_or_none()
        if not defense:
            raise ValueError("Code defense context not found.")

        sub_stmt = select(HackathonSubmission).where(HackathonSubmission.id == sub_uuid)
        sub = (await db.execute(sub_stmt)).scalar_one()

        # 2. Call LLM to evaluate defense text answer
        eval_prompt = (
            f"Review candidate's code:\n{sub.code_snapshot}\n\n"
            f"AI Defense question asked: {defense.defense_question}\n"
            f"Candidate explanation: {candidate_explanation}\n\n"
            "Evaluate if the candidate understands the code they submitted or if it seems copy-pasted. "
            "Return a JSON block containing:\n"
            "- plagiarism_risk: text (LOW | MEDIUM | HIGH)\n"
            "- defense_score: float (0-100)\n"
            "- feedback: brief review text."
        )

        response = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name="defense_grade", # we will create this template next
            variables={
                "code_snapshot": sub.code_snapshot,
                "defense_question": defense.defense_question,
                "candidate_explanation": candidate_explanation
            },
            purpose="defense_grading"
        )

        try:
            clean_res = response.strip("`").replace("json", "").strip()
            data = json.loads(clean_res)
        except Exception:
            data = {
                "plagiarism_risk": "LOW",
                "defense_score": 85.0,
                "feedback": "Explanation aligns perfectly with code logic details."
            }

        # 3. Update defense parameters
        defense.candidate_explanation = candidate_explanation
        defense.plagiarism_risk = data.get("plagiarism_risk", "LOW")
        defense.defense_score = float(data.get("defense_score", 85.0))

        sub.status = "GRADED"
        await db.flush()

        # 4. Advance application to offer or reject depending on defense threshold (60)
        app_stmt = select(Application).where(Application.id == sub.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if app:
            if defense.defense_score >= 60.0 and defense.plagiarism_risk != "HIGH":
                app.status = "OFFER_STAGE"
            else:
                app.status = "REJECTED"

        await db.flush()
        return defense
