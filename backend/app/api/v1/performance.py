"""
Performance Management API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.performance import PerformanceReview, PerformanceGoal

router = APIRouter(prefix="/performance", tags=["Performance Management"])


class CreateReviewRequest(BaseModel):
    employee_name: str
    employee_email: str
    review_period: str  # e.g., Q1 2026
    reviewer_name: str
    goals: Optional[dict] = None
    ratings: Optional[dict] = None


class UpdateReviewRequest(BaseModel):
    ratings: Optional[dict] = None
    goals: Optional[dict] = None
    overall_score: Optional[float] = None
    summary: Optional[str] = None
    status: Optional[str] = None  # DRAFT | SUBMITTED | APPROVED


class CreateGoalRequest(BaseModel):
    employee_name: str
    employee_email: str
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class UpdateGoalProgressRequest(BaseModel):
    progress: int  # 0-100


@router.post("/reviews", status_code=status.HTTP_201_CREATED)
async def create_performance_review(
    body: CreateReviewRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    review = PerformanceReview(
        employee_id=uuid.uuid4(),  # Mock directory user ID
        employee_name=body.employee_name,
        employee_email=body.employee_email,
        review_period=body.review_period,
        reviewer_name=body.reviewer_name,
        goals=body.goals or {},
        ratings=body.ratings or {},
        status="DRAFT",
        tenant_id=tid,
    )
    db.add(review)
    await db.flush()
    return review


@router.get("/reviews")
async def get_performance_reviews(
    db: DBSession,
    tenant_id: TenantId,
    employee_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(PerformanceReview).where(PerformanceReview.tenant_id == tid)
    if employee_id:
        stmt = stmt.where(PerformanceReview.employee_id == employee_id)
    if status:
        stmt = stmt.where(PerformanceReview.status == status)
    stmt = stmt.order_by(PerformanceReview.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/reviews/{review_id}")
async def get_performance_review(
    review_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(PerformanceReview).where(PerformanceReview.id == review_id, PerformanceReview.tenant_id == tid)
    result = await db.execute(stmt)
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    return review


@router.patch("/reviews/{review_id}")
async def update_performance_review(
    review_id: uuid.UUID,
    body: UpdateReviewRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(PerformanceReview).where(PerformanceReview.id == review_id, PerformanceReview.tenant_id == tid)
    result = await db.execute(stmt)
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
        
    if body.ratings is not None:
        review.ratings = body.ratings
    if body.goals is not None:
        review.goals = body.goals
    if body.overall_score is not None:
        review.overall_score = body.overall_score
    if body.summary is not None:
        review.summary = body.summary
    if body.status is not None:
        review.status = body.status
        
    await db.flush()
    return review


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: CreateGoalRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    goal = PerformanceGoal(
        employee_id=uuid.uuid4(),  # Mock directory user ID
        employee_name=body.employee_name,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
        progress=0,
        status="ACTIVE",
        tenant_id=tid,
    )
    db.add(goal)
    await db.flush()
    return goal


@router.get("/goals")
async def get_goals(
    db: DBSession,
    tenant_id: TenantId,
    employee_id: Optional[uuid.UUID] = None,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(PerformanceGoal).where(PerformanceGoal.tenant_id == tid)
    if employee_id:
        stmt = stmt.where(PerformanceGoal.employee_id == employee_id)
    stmt = stmt.order_by(PerformanceGoal.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/goals/{goal_id}/progress")
async def update_goal_progress(
    goal_id: uuid.UUID,
    body: UpdateGoalProgressRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(PerformanceGoal).where(PerformanceGoal.id == goal_id, PerformanceGoal.tenant_id == tid)
    result = await db.execute(stmt)
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Performance goal not found")
        
    goal.progress = body.progress
    if body.progress >= 100:
        goal.status = "COMPLETED"
    else:
        goal.status = "ACTIVE"
        
    await db.flush()
    return goal
