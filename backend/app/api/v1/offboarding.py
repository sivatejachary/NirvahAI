"""
Offboarding API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.offboarding import OffboardingPlan, OffboardingTask

router = APIRouter(prefix="/offboarding", tags=["Offboarding"])


class CreateOffboardingPlanRequest(BaseModel):
    employee_name: str
    employee_email: str
    last_day: datetime
    reason: str  # RESIGNATION | TERMINATION | RETIREMENT | CONTRACT_END


class ExitInterviewRequest(BaseModel):
    feedback: str


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_offboarding_plan(
    body: CreateOffboardingPlanRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    plan = OffboardingPlan(
        employee_id=uuid.uuid4(),  # Mock directory user ID
        employee_name=body.employee_name,
        employee_email=body.employee_email,
        last_day=body.last_day,
        reason=body.reason,
        exit_interview_done=False,
        status="INITIATED",
        tenant_id=tid,
    )
    db.add(plan)
    await db.flush()
    
    default_tasks = [
        ("Revoke system access", "IT"),
        ("Collect laptop and equipment", "IT"),
        ("Process final payslip", "FINANCE"),
        ("Update employee records", "HR"),
        ("Issue experience letter", "HR"),
        ("Knowledge transfer sessions", "KNOWLEDGE"),
        ("Documentation handover", "KNOWLEDGE"),
        ("Return ID card", "ASSETS"),
        ("Return company assets", "ASSETS"),
    ]
    
    for task_name, category in default_tasks:
        task = OffboardingTask(
            plan_id=plan.id,
            task_name=task_name,
            category=category,
            status="PENDING",
            tenant_id=tid,
        )
        db.add(task)
        
    await db.flush()
    return plan


@router.get("/plans")
async def get_offboarding_plans(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OffboardingPlan).where(OnboardingPlan.tenant_id == tid).order_by(OffboardingPlan.created_at.desc())
    
    # SQLAlchemy syntax safety: OffboardingPlan.tenant_id
    stmt = select(OffboardingPlan).where(OffboardingPlan.tenant_id == tid).order_by(OffboardingPlan.created_at.desc())
    result = await db.execute(stmt)
    plans = result.scalars().all()
    
    response_plans = []
    for plan in plans:
        tasks_stmt = select(OffboardingTask).where(OffboardingTask.plan_id == plan.id, OffboardingTask.tenant_id == tid)
        tasks_res = await db.execute(tasks_stmt)
        tasks = tasks_res.scalars().all()
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == "DONE")
        
        plan_dict = {
            "id": plan.id,
            "employee_id": plan.employee_id,
            "employee_name": plan.employee_name,
            "employee_email": plan.employee_email,
            "last_day": plan.last_day,
            "reason": plan.reason,
            "exit_interview_done": plan.exit_interview_done,
            "exit_feedback": plan.exit_feedback,
            "status": plan.status,
            "created_at": plan.created_at,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks
        }
        response_plans.append(plan_dict)
        
    return response_plans


@router.get("/plans/{plan_id}")
async def get_offboarding_plan_details(
    plan_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OffboardingPlan).where(OffboardingPlan.id == plan_id, OffboardingPlan.tenant_id == tid)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Offboarding plan not found")
        
    tasks_stmt = select(OffboardingTask).where(
        OffboardingTask.plan_id == plan.id,
        OffboardingTask.tenant_id == tid
    ).order_by(OffboardingTask.created_at.asc())
    tasks_result = await db.execute(tasks_stmt)
    tasks = tasks_result.scalars().all()
    
    return {
        "plan": plan,
        "tasks": tasks
    }


@router.post("/{plan_id}/exit-interview")
async def record_exit_interview(
    plan_id: uuid.UUID,
    body: ExitInterviewRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OffboardingPlan).where(OffboardingPlan.id == plan_id, OffboardingPlan.tenant_id == tid)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Offboarding plan not found")
        
    plan.exit_feedback = body.feedback
    plan.exit_interview_done = True
    await db.flush()
    return plan


@router.patch("/tasks/{task_id}/complete")
async def complete_offboarding_task(
    task_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OffboardingTask).where(OffboardingTask.id == task_id, OffboardingTask.tenant_id == tid)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Offboarding task not found")
        
    task.status = "DONE"
    task.completed_at = datetime.utcnow()
    
    # If all tasks are completed, set offboarding plan to COMPLETE
    tasks_stmt = select(OffboardingTask).where(OffboardingTask.plan_id == task.plan_id, OffboardingTask.tenant_id == tid)
    tasks_res = await db.execute(tasks_stmt)
    all_tasks = tasks_res.scalars().all()
    
    if all(t.status == "DONE" or t.id == task_id for t in all_tasks):
        plan_stmt = select(OffboardingPlan).where(OffboardingPlan.id == task.plan_id, OffboardingPlan.tenant_id == tid)
        plan_res = await db.execute(plan_stmt)
        plan = plan_res.scalar_one_or_none()
        if plan:
            plan.status = "COMPLETE"
            
    await db.flush()
    return task
