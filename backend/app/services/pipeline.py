"""
Recruitment Pipeline Service
Manages the dynamic 15-stage sequential AI recruitment pipeline.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
import httpx

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import ApplicationStage, STAGE_NAMES
from app.models.tenant import CompanySettings
from app.core.logging import get_logger

logger = get_logger(__name__)

VIDYAMARGAI_SYNC_URL = "https://vidyamargai-production-1fc2.up.railway.app/api/v1"

DEFAULT_WORKFLOW = {
    "stages": [
        {"stage_number": 1, "stage_name": "Resume Screening", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 2, "stage_name": "MCQ Assessment", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.80, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 3, "stage_name": "Coding Assessment", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.80, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 4, "stage_name": "AI Technical Interview", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.75, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 5, "stage_name": "Hackathon / Assignment", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.75, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 6, "stage_name": "AI HR Call (Post-Technical)", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 7, "stage_name": "Technical Interview (Human)", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.75, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 8, "stage_name": "AI HR Call (Post-Interview)", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 9, "stage_name": "HR / Hiring Manager Round", "enabled": True, "pass_mark": 60.0, "ai_confidence_threshold": 0.75, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 10, "stage_name": "AI HR Call (Pre-Offer)", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 11, "stage_name": "Offer Letter", "enabled": True, "pass_mark": 1.0, "ai_confidence_threshold": 0.90, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 12, "stage_name": "AI HR Call (Post-Offer)", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 13, "stage_name": "Background Verification", "enabled": True, "pass_mark": 1.0, "ai_confidence_threshold": 0.90, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 14, "stage_name": "AI HR Call (BGV Update)", "enabled": True, "pass_mark": 50.0, "ai_confidence_threshold": 0.70, "require_human_approval": False, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}},
        {"stage_number": 15, "stage_name": "Joining & Onboarding", "enabled": True, "pass_mark": 1.0, "ai_confidence_threshold": 0.90, "require_human_approval": True, "notifications": {"email": True, "whatsapp": True, "sms": False, "in_app": True}}
    ]
}


class PipelineService:
    
    @staticmethod
    async def initialize_pipeline(db: AsyncSession, tenant_id: str, application_id: str) -> List[ApplicationStage]:
        """
        Creates enabled stages for a candidate application based on companySettings.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        # Retrieve dynamic workflow config
        settings_stmt = select(CompanySettings).where(CompanySettings.tenant_id == t_uuid)
        settings = (await db.execute(settings_stmt)).scalar_one_or_none()
        
        stages_config = DEFAULT_WORKFLOW["stages"]
        if settings and settings.recruitment_workflow and "stages" in settings.recruitment_workflow:
            stages_config = settings.recruitment_workflow["stages"]
            
        enabled_stages = [s for s in stages_config if s.get("enabled", True)]
        enabled_stages.sort(key=lambda x: x.get("stage_number", 0))
        
        stages = []
        for idx, s_config in enumerate(enabled_stages):
            s_num = s_config.get("stage_number")
            s_name = s_config.get("stage_name")
            
            meta = {
                "pass_mark": s_config.get("pass_mark", 50.0),
                "ai_confidence_threshold": s_config.get("ai_confidence_threshold", 0.75),
                "require_human_approval": s_config.get("require_human_approval", False),
                "notifications": s_config.get("notifications", {})
            }
            
            stage = ApplicationStage(
                tenant_id=t_uuid,
                application_id=a_uuid,
                stage_number=s_num,
                stage_name=s_name,
                status="PENDING" if idx == 0 else "LOCKED",
                metadata=meta
            )
            db.add(stage)
            stages.append(stage)
        
        await db.flush()
        logger.info("PIPELINE_INITIALIZED", application_id=str(application_id), stages_count=len(stages))
        return stages

    @staticmethod
    async def get_pipeline(db: AsyncSession, tenant_id: str, application_id: str) -> List[ApplicationStage]:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid
        ).order_by(ApplicationStage.stage_number)
        
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def advance_stage(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        stage_number: int,
        status: str,
        score: Optional[float] = None,
        feedback: Optional[str] = None,
        ai_recommendation: Optional[str] = None,
        ai_evaluated: bool = False
    ) -> Optional[ApplicationStage]:
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        stage_stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number
        )
        stage = (await db.execute(stage_stmt)).scalar_one_or_none()
        
        if not stage:
            return None
        
        stage.status = status
        stage.completed_at = datetime.now(timezone.utc)
        if score is not None:
            stage.score = score
        if feedback:
            stage.feedback = feedback
        if ai_recommendation:
            stage.ai_recommendation = ai_recommendation
        stage.ai_evaluated = ai_evaluated
        
        # If PASSED, unlock next enabled stage in sequential order
        if status == "PASSED":
            stages_list = await PipelineService.get_pipeline(db, tenant_id, application_id)
            next_stage = None
            for s in stages_list:
                if s.stage_number > stage_number:
                    next_stage = s
                    break
            if next_stage and next_stage.status == "LOCKED":
                next_stage.status = "PENDING"
        
        await db.flush()
        
        await PipelineService._sync_to_vidyamargai(
            application_id=application_id,
            stage_number=stage_number,
            stage_name=stage.stage_name,
            status=status,
            score=score,
            feedback=feedback
        )
        
        return stage

    @staticmethod
    async def evaluate_stage(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        stage_number: int,
        score: float,
        ai_confidence: float = 1.0,
        ai_feedback: Optional[str] = None
    ) -> Optional[ApplicationStage]:
        """
        Executes automatic AI evaluation at a stage based on company config rules.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        stage_stmt = select(ApplicationStage).where(
            ApplicationStage.tenant_id == t_uuid,
            ApplicationStage.application_id == a_uuid,
            ApplicationStage.stage_number == stage_number
        )
        stage = (await db.execute(stage_stmt)).scalar_one_or_none()
        if not stage:
            return None
            
        meta = stage.metadata or {}
        pass_mark = meta.get("pass_mark", 50.0)
        threshold = meta.get("ai_confidence_threshold", 0.75)
        require_human_approval = meta.get("require_human_approval", False)
        notifications = meta.get("notifications", {})
        
        stage.score = score
        stage.started_at = stage.started_at or datetime.now(timezone.utc)
        stage.ai_evaluated = True
        
        if ai_confidence < threshold or require_human_approval:
            # 3. REVIEW Required
            stage.status = "PENDING"
            stage.feedback = f"AI Review Required: Score {score}%. (AI Confidence {ai_confidence} below threshold {threshold} or requires human approval)."
            if ai_feedback:
                stage.feedback += f" Details: {ai_feedback}"
            logger.info("STAGE_REVIEW_REQUIRED", application_id=str(a_uuid), stage=stage_number)
            await PipelineService._send_notifications(
                recipient="recruiter", channel="in_app", event="stage_review",
                stage_name=stage.stage_name, candidate_id=str(a_uuid), details=stage.feedback
            )
        elif score >= pass_mark:
            # 1. PASS
            stage.status = "PASSED"
            stage.completed_at = datetime.now(timezone.utc)
            stage.feedback = f"AI Auto-Passed: Score {score}% meets pass mark {pass_mark}%."
            if ai_feedback:
                stage.feedback += f" Details: {ai_feedback}"
            
            # Unlock next stage
            stages_list = await PipelineService.get_pipeline(db, tenant_id, application_id)
            next_stage = None
            for s in stages_list:
                if s.stage_number > stage_number:
                    next_stage = s
                    break
            if next_stage and next_stage.status == "LOCKED":
                next_stage.status = "PENDING"
                
            # Send candidate notifications
            for channel in ["email", "whatsapp", "sms", "in_app"]:
                if notifications.get(channel, True) or (channel == "in_app"):
                    await PipelineService._send_notifications(
                        recipient="candidate", channel=channel, event="stage_passed",
                        stage_name=stage.stage_name, candidate_id=str(a_uuid)
                    )
        else:
            # 2. FAIL
            stage.status = "FAILED"
            stage.completed_at = datetime.now(timezone.utc)
            stage.feedback = f"AI Rejection: Score {score}% is below pass mark {pass_mark}%."
            if ai_feedback:
                stage.feedback += f" Details: {ai_feedback}"
                
            # Send failure notifications
            for channel in ["email", "whatsapp", "sms", "in_app"]:
                if notifications.get(channel, True) or (channel == "in_app"):
                    await PipelineService._send_notifications(
                        recipient="candidate", channel=channel, event="stage_failed",
                        stage_name=stage.stage_name, candidate_id=str(a_uuid), details=stage.feedback
                    )
                    
        await db.flush()
        
        await PipelineService._sync_to_vidyamargai(
            application_id=application_id,
            stage_number=stage_number,
            stage_name=stage.stage_name,
            status=stage.status,
            score=score,
            feedback=stage.feedback
        )
        
        return stage

    @staticmethod
    async def _send_notifications(recipient: str, channel: str = "in_app", event: str = "stage_passed", **kwargs):
        logger.info(f"NOTIFICATION: {recipient} via {channel} ({event}) Details: {kwargs}")

    @staticmethod
    async def _sync_to_vidyamargai(application_id: str, stage_number: int, stage_name: str,
                                    status: str, score: Optional[float] = None, feedback: Optional[str] = None):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{VIDYAMARGAI_SYNC_URL}/sync/stages",
                    json={"application_id": str(application_id), "stage_number": stage_number,
                          "stage_name": stage_name, "status": status, "score": score, "feedback": feedback}
                )
        except Exception as e:
            logger.warning("VIDYAMARGAI_SYNC_FAILED", error=str(e))
