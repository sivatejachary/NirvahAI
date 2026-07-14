"""
Workflows & AI Model Gateway Router — Phase 3
Handles recruitment pipelines and AI model executions with cost governor.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services.workflows import WorkflowService
from app.services.llm import LLMGateway, BudgetExceededError
from app.models.ai import AIUsageLog

router = APIRouter(prefix="/workflows", tags=["Workflows & AI Gateway"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkflowStart(BaseModel):
    application_id: str
    initial_state: Optional[Dict[str, Any]] = None


class WorkflowTransition(BaseModel):
    next_stage: str  # MCQ | CODING | TECHNICAL_INTERVIEW | etc.
    state_updates: Dict[str, Any]


class LLMSimulation(BaseModel):
    prompt_name: str  # e.g., resume_parse
    variables: Dict[str, Any]
    model_name: Optional[str] = "gemini-1.5-flash"
    purpose: Optional[str] = "general"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def start_workflow(
    db: DBSession,
    tenant_id: TenantId,
    body: WorkflowStart
):
    instance = await WorkflowService.start_recruitment_workflow(
        db,
        tenant_id=tenant_id,
        application_id=body.application_id,
        initial_state=body.initial_state
    )
    return instance


@router.get("/{instance_id}", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def get_workflow(
    db: DBSession,
    tenant_id: TenantId,
    instance_id: str
):
    instance = await WorkflowService.get_workflow_instance(db, tenant_id, instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found.")
    return instance


@router.post("/{instance_id}/transition", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def transition_workflow(
    db: DBSession,
    tenant_id: TenantId,
    instance_id: str,
    body: WorkflowTransition
):
    instance = await WorkflowService.transition_stage(
        db,
        tenant_id=tenant_id,
        instance_id=instance_id,
        next_stage=body.next_stage,
        state_updates=body.state_updates
    )
    if not instance:
        raise HTTPException(status_code=404, detail="Workflow instance not found.")
    return instance


@router.get("/metrics/spend", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def get_ai_spend(
    db: DBSession,
    tenant_id: TenantId
):
    """
    Returns AI cost statistics for the current billing cycle.
    """
    import uuid
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    stmt = select(func.sum(AIUsageLog.cost_usd)).where(
        AIUsageLog.tenant_id == t_uuid,
        AIUsageLog.created_at >= start_of_month
    )
    monthly_spend = (await db.execute(stmt)).scalar() or 0.0
    
    return {"monthly_spend_usd": monthly_spend, "billing_cycle_start": start_of_month}


@router.post("/simulate-llm", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def simulate_llm_call(
    db: DBSession,
    tenant_id: TenantId,
    body: LLMSimulation
):
    """
    Simulates routing an AI call through the Cost Governor and Prompt Registry.
    """
    try:
        completion = await LLMGateway.call_llm(
            db=db,
            tenant_id=tenant_id,
            prompt_name=body.prompt_name,
            variables=body.variables,
            model_name=body.model_name,
            purpose=body.purpose
        )
        return {"status": "success", "completion": completion}
    except BudgetExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(e)
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
