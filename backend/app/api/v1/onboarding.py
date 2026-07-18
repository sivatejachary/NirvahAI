"""
Onboarding API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.onboarding import OnboardingPlan, OnboardingTask

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class CreateOnboardingPlanRequest(BaseModel):
    employee_name: str
    employee_email: str
    department: Optional[str] = None
    start_date: Optional[datetime] = None
    buddy_name: Optional[str] = None


class UpdateOnboardingPlanRequest(BaseModel):
    buddy_name: Optional[str] = None
    status: Optional[str] = None  # PENDING | IN_PROGRESS | COMPLETE


class CreateOnboardingTaskRequest(BaseModel):
    task_name: str
    category: str  # DOCUMENT | IT | TRAINING | ORIENTATION | MEETING
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_onboarding_plan(
    body: CreateOnboardingPlanRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    plan = OnboardingPlan(
        employee_id=uuid.uuid4(),  # generate mock directory ID
        employee_name=body.employee_name,
        employee_email=body.employee_email,
        department=body.department,
        start_date=body.start_date,
        buddy_name=body.buddy_name,
        status="PENDING",
        tenant_id=tid,
    )
    db.add(plan)
    await db.flush()
    
    default_tasks = [
        ("Submit ID documents", "DOCUMENT"),
        ("Sign employment contract", "DOCUMENT"),
        ("Laptop provisioning", "IT"),
        ("Email account setup", "IT"),
        ("Software access setup", "IT"),
        ("Company orientation session", "ORIENTATION"),
        ("Team introduction meeting", "ORIENTATION"),
        ("Role-specific training", "TRAINING"),
    ]
    
    for task_name, category in default_tasks:
        task = OnboardingTask(
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
async def get_onboarding_plans(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OnboardingPlan).where(OnboardingPlan.tenant_id == tid).order_by(OnboardingPlan.created_at.desc())
    result = await db.execute(stmt)
    plans = result.scalars().all()
    
    # We want to return tasks summary along with plans
    response_plans = []
    for plan in plans:
        # get tasks counts
        tasks_stmt = select(OnboardingTask).where(OnboardingTask.plan_id == plan.id, OnboardingTask.tenant_id == tid)
        tasks_res = await db.execute(tasks_stmt)
        tasks = tasks_res.scalars().all()
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == "DONE")
        
        plan_dict = {
            "id": plan.id,
            "employee_id": plan.employee_id,
            "employee_name": plan.employee_name,
            "employee_email": plan.employee_email,
            "department": plan.department,
            "start_date": plan.start_date,
            "buddy_name": plan.buddy_name,
            "status": plan.status,
            "created_at": plan.created_at,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks
        }
        response_plans.append(plan_dict)
        
    return response_plans


@router.get("/plans/{plan_id}")
async def get_onboarding_plan_details(
    plan_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OnboardingPlan).where(OnboardingPlan.id == plan_id, OnboardingPlan.tenant_id == tid)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Onboarding plan not found")
        
    tasks_stmt = select(OnboardingTask).where(
        OnboardingTask.plan_id == plan.id,
        OnboardingTask.tenant_id == tid
    ).order_by(OnboardingTask.created_at.asc())
    tasks_result = await db.execute(tasks_stmt)
    tasks = tasks_result.scalars().all()
    
    return {
        "plan": plan,
        "tasks": tasks
    }


@router.patch("/plans/{plan_id}")
async def update_onboarding_plan(
    plan_id: uuid.UUID,
    body: UpdateOnboardingPlanRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OnboardingPlan).where(OnboardingPlan.id == plan_id, OnboardingPlan.tenant_id == tid)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Onboarding plan not found")
        
    if body.buddy_name is not None:
        plan.buddy_name = body.buddy_name
    if body.status is not None:
        plan.status = body.status
        
    await db.flush()
    return plan


@router.post("/plans/{plan_id}/tasks")
async def add_onboarding_task(
    plan_id: uuid.UUID,
    body: CreateOnboardingTaskRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Verify plan exists
    stmt = select(OnboardingPlan).where(OnboardingPlan.id == plan_id, OnboardingPlan.tenant_id == tid)
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Onboarding plan not found")
        
    task = OnboardingTask(
        plan_id=plan_id,
        task_name=body.task_name,
        category=body.category,
        due_date=body.due_date,
        assigned_to=body.assigned_to,
        status="PENDING",
        tenant_id=tid,
    )
    db.add(task)
    await db.flush()
    return task


@router.patch("/tasks/{task_id}/complete")
async def complete_onboarding_task(
    task_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OnboardingTask).where(OnboardingTask.id == task_id, OnboardingTask.tenant_id == tid)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Onboarding task not found")
        
    task.status = "DONE"
    task.completed_at = datetime.utcnow()
    await db.flush()
    return task


# ── Root alias so GET /onboarding returns plans list ─────────────────────────
@router.get("", dependencies=[Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter"))])
async def list_onboarding_root(db: DBSession, tenant_id: TenantId):
    """Alias: GET /onboarding → returns onboarding plans list."""
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(OnboardingPlan).where(OnboardingPlan.tenant_id == tid).order_by(OnboardingPlan.created_at.desc())
    result = await db.execute(stmt)
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "employee_name": p.employee_name,
            "employee_email": p.employee_email,
            "department": p.department,
            "status": p.status,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in plans
    ]

