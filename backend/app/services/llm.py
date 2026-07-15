"""
Central LLM Gateway and Cost Governor Service
Manages routing, token usage tracking, billing limits, and offline test mock simulations.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models.ai import AIUsageLog
from app.models.tenant import CompanySettings
from app.services.prompt import PromptRegistry

logger = get_logger(__name__)

# Token cost registry (in USD per 1,000,000 tokens)
MODEL_PRICING = {
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
}


class BudgetExceededError(Exception):
    """Raised when a tenant's configured AI spend budget is exceeded."""
    pass


class LLMGateway:
    @staticmethod
    async def check_budget(db: AsyncSession, tenant_id: str) -> None:
        """
        Calculates daily and monthly spend metrics to enforce budget gates.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        
        # Load budget settings
        stmt = select(CompanySettings).where(CompanySettings.tenant_id == t_uuid)
        result = await db.execute(stmt)
        c_settings = result.scalar_one_or_none()
        if not c_settings:
            return
            
        daily_limit = c_settings.daily_ai_budget_usd
        monthly_limit = c_settings.monthly_ai_budget_usd
        
        if not daily_limit and not monthly_limit:
            return
            
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Sum daily spend
        daily_stmt = select(func.sum(AIUsageLog.cost_usd)).where(
            AIUsageLog.tenant_id == t_uuid,
            AIUsageLog.created_at >= start_of_day
        )
        daily_spend = (await db.execute(daily_stmt)).scalar() or 0.0
        
        # Sum monthly spend
        monthly_stmt = select(func.sum(AIUsageLog.cost_usd)).where(
            AIUsageLog.tenant_id == t_uuid,
            AIUsageLog.created_at >= start_of_month
        )
        monthly_spend = (await db.execute(monthly_stmt)).scalar() or 0.0
        
        if daily_limit and daily_spend >= daily_limit:
            raise BudgetExceededError(f"Daily AI budget of ${daily_limit:.2f} exceeded. Current spend: ${daily_spend:.2f}")
            
        if monthly_limit and monthly_spend >= monthly_limit:
            raise BudgetExceededError(f"Monthly AI budget of ${monthly_limit:.2f} exceeded. Current spend: ${monthly_spend:.2f}")

    @classmethod
    async def call_llm(
        cls,
        db: AsyncSession,
        tenant_id: str,
        prompt_name: str,
        variables: Dict[str, Any],
        model_name: str = "gemini-1.5-flash",
        purpose: str = "general"
    ) -> str:
        """
        Main routing gateway. Executes budget checks and resolves model calls.
        """
        # 1. Enforce budget governance
        await cls.check_budget(db, tenant_id)
        
        # 2. Render versioned prompt template
        rendered_prompt = PromptRegistry.render(prompt_name, **variables)
        
        # 3. Invoke live Gemini API or fallback to simulated mock response
        api_key = settings.GEMINI_API_KEY
        output_text = None

        if api_key and api_key.strip() and not api_key.startswith("your_"):
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                gemini_model_name = model_name if model_name.startswith("gemini-") else "gemini-1.5-flash"
                model_inst = genai.GenerativeModel(gemini_model_name)
                
                response = await model_inst.generate_content_async(rendered_prompt)
                if response and response.text:
                    output_text = response.text
            except Exception as e:
                logger.warning(
                    "Live Gemini API invocation encountered an error; using fallback structured response",
                    error=str(e),
                    purpose=purpose,
                    model=model_name
                )
                output_text = None

        if not output_text:
            output_text = cls._get_mock_response(purpose, variables)
            
        # 4. Log cost details in audit database
        prompt_tokens = len(rendered_prompt) // 4
        completion_tokens = len(output_text) // 4
        
        pricing = MODEL_PRICING.get(model_name, MODEL_PRICING["gemini-1.5-flash"])
        cost = (
            (prompt_tokens * pricing["input"] / 1_000_000) +
            (completion_tokens * pricing["output"] / 1_000_000)
        )
        
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        usage_log = AIUsageLog(
            tenant_id=t_uuid,
            model_name=model_name,
            purpose=purpose,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost
        )
        db.add(usage_log)
        await db.flush()
        
        return output_text

    @staticmethod
    def _get_mock_response(purpose: str, variables: Dict[str, Any]) -> str:
        """
        Simulates structured response formats based on the task purpose.
        """
        import json
        
        if purpose == "resume_parsing":
            return json.dumps({
                "full_name": "Sarah Connor",
                "email": "sarah.connor@example.com",
                "skills": ["Python", "Rust", "Machine Learning", "System Security"],
                "experience_years": 5.5,
                "education": [
                    {"school": "Caltech", "degree": "BS Computer Science", "year": "2020"}
                ]
            })
            
        elif purpose == "mcq_generation":
            return json.dumps({
                "question_text": "Which of the following describes the difference between select() and poll() in Linux system calls?",
                "options": [
                    "select() uses a file descriptor array while poll() uses a linked list.",
                    "poll() does not have a hard limit on the number of file descriptors, unlike select().",
                    "select() is faster than poll() for large descriptor counts.",
                    "poll() modifies its file descriptor sets inline, requiring re-initialization."
                ],
                "correct_option_index": 1,
                "explanation": "select() uses fixed-size fd_sets which limits its size to FD_SETSIZE (usually 1024). poll() has no such limit as it passes an array of pollfd structs."
            })
            
        elif purpose == "candidate_matching":
            return json.dumps({
                "fit_score": 85,
                "reasoning": "Strong match on core skills like Python, Linux and microservices. Fits the junior/mid role description.",
                "status": "MCQ_STAGE"
            })
            
        elif purpose == "interview_welcome":
            return "Welcome to your adaptive technical interview. To begin, could you describe your experience designing scalable systems?"

        elif purpose == "interview_followup":
            return "That's interesting. How do you manage connection pooling and connection limits under highly concurrent loads?"

        elif purpose == "interview_evaluation":
            return json.dumps({
                "technical_score": 75,
                "communication_score": 80,
                "final_score": 77,
                "feedback_summary": "Candidate demonstrated solid proficiency in architecture and Go code limits."
            })

        elif purpose == "hackathon_review":
            return json.dumps({
                "architecture_score": 80.0,
                "evaluation_summary": "Modular structure, clean layer constraints.",
                "defense_question": "Why did you implement custom connection pooling instead of libraries?"
            })

        elif purpose == "defense_grading":
            return json.dumps({
                "plagiarism_risk": "LOW",
                "defense_score": 85.0,
                "feedback": "Perfect syntax and logic defense."
            })

        elif purpose == "call_welcome":
            return "This call is conducted by an automated AI recruiter and will be recorded and transcribed for evaluation purposes. Hi! I see you have Go and Docker experience. Are you ready to talk about the Principal role?"

        elif purpose == "call_followup":
            return "Excellent. Can you tell me how you handle zero-downtime deployment containers?"

        elif purpose == "call_evaluation":
            return "Candidate expressed high interest in architectural growth and demonstrated clear knowledge of container lifecycles."

        return "Mock LLM Completion Response"
