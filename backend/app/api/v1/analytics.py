"""
Analytics API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, status
from sqlalchemy import select, func

from app.api.deps import DBSession, TenantId, require_role
from app.models.application import Application
from app.models.job import Job
from app.models.offer import Offer
from app.models.selection import ManagerInterview

router = APIRouter(prefix="/analytics", tags=["Analytics & Insights"])


@router.get("/overview")
async def get_analytics_overview(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Jobs count
    jobs_stmt = select(func.count(Job.id)).where(Job.tenant_id == tid)
    jobs_res = await db.execute(jobs_stmt)
    jobs_count = jobs_res.scalar() or 0
    
    # Applications count
    apps_stmt = select(func.count(Application.id)).where(Application.tenant_id == tid)
    apps_res = await db.execute(apps_stmt)
    apps_count = apps_res.scalar() or 0
    
    # Manager interviews (passed) count
    interviews_stmt = select(func.count(ManagerInterview.id)).where(
        ManagerInterview.tenant_id == tid,
        ManagerInterview.decision == "PASS"
    )
    interviews_res = await db.execute(interviews_stmt)
    interviews_count = interviews_res.scalar() or 0
    
    # Offers counts
    offers_stmt = select(func.count(Offer.id)).where(Offer.tenant_id == tid)
    offers_res = await db.execute(offers_stmt)
    offers_count = offers_res.scalar() or 0
    
    accepted_offers_stmt = select(func.count(Offer.id)).where(
        Offer.tenant_id == tid,
        Offer.status == "ACCEPTED"
    )
    accepted_res = await db.execute(accepted_offers_stmt)
    accepted_offers_count = accepted_res.scalar() or 0
    
    rate = (accepted_offers_count / offers_count * 100) if offers_count > 0 else 0.0
    
    return {
        "total_jobs": jobs_count,
        "total_applications": apps_count,
        "interviews_completed": interviews_count,
        "offers_sent": offers_count,
        "offer_acceptance_rate": round(rate, 1)
    }


@router.get("/hiring-funnel")
async def get_hiring_funnel(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(Application.status, func.count(Application.id)).where(
        Application.tenant_id == tid
    ).group_by(Application.status)
    result = await db.execute(stmt)
    rows = result.all()
    
    # Calculate percentages
    total = sum(row[1] for row in rows)
    funnel = []
    for stage, count in rows:
        pct = (count / total * 100) if total > 0 else 0.0
        funnel.append({
            "stage": stage,
            "count": count,
            "percentage": round(pct, 1)
        })
        
    # Sort funnel by logical stage
    stage_order = ["APPLIED", "MCQ_STAGE", "CODING_STAGE", "INTERVIEW_STAGE", "OFFER_STAGE", "COMPLETED", "REJECTED"]
    funnel.sort(key=lambda x: stage_order.index(x["stage"]) if x["stage"] in stage_order else 99)
    return funnel


@router.get("/time-to-hire")
async def get_time_to_hire(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Calculate time differences for completed/hired candidates
    stmt = select(Application.created_at, Application.updated_at).where(
        Application.tenant_id == tid,
        Application.status.in_(["COMPLETED", "OFFER_STAGE"])
    )
    result = await db.execute(stmt)
    apps = result.all()
    
    if not apps:
        return {"average_days": 0.0, "min_days": 0.0, "max_days": 0.0}
        
    diffs = [(app[1] - app[0]).total_seconds() / 86400.0 for app in apps]
    return {
        "average_days": round(sum(diffs) / len(diffs), 1),
        "min_days": round(min(diffs), 1),
        "max_days": round(max(diffs), 1)
    }


@router.get("/offers")
async def get_offers_analytics(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer.status, func.count(Offer.id)).where(Offer.tenant_id == tid).group_by(Offer.status)
    result = await db.execute(stmt)
    rows = result.all()
    
    counts = {"total": 0, "draft": 0, "sent": 0, "accepted": 0, "declined": 0, "expired": 0}
    for status_val, count in rows:
        counts["total"] += count
        if status_val.lower() == "draft":
            counts["draft"] = count
        elif status_val.lower() == "sent":
            counts["sent"] = count
        elif status_val.lower() == "accepted":
            counts["accepted"] = count
        elif status_val.lower() == "declined":
            counts["declined"] = count
        elif status_val.lower() == "expired":
            counts["expired"] = count
            
    total = counts["total"]
    accepted = counts["accepted"]
    counts["acceptance_rate"] = round((accepted / total * 100) if total > 0 else 0.0, 1)
    return counts


@router.get("/bias-audit")
async def get_bias_audit(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    stmt = select(Application.status, func.count(Application.id)).where(
        Application.tenant_id == tid
    ).group_by(Application.status)
    result = await db.execute(stmt)
    rows = result.all()
    
    status_distribution = {row[0]: row[1] for row in rows}
    
    return {
        "note": "Bias audit requires demographic data collection. Currently auditing stage conversions.",
        "status_distribution": status_distribution
    }


@router.get("/morning-brief", dependencies=[Depends(require_role("tenant_admin", "hr_manager"))])
async def get_recruiter_morning_brief(db: DBSession, tenant_id: TenantId):
    from app.services.analytics_service import AnalyticsService
    try:
        brief = await AnalyticsService.generate_morning_brief(db, tenant_id)
        return brief
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/platform", dependencies=[Depends(require_role("platform_admin"))])
async def get_platform_admin_analytics(db: DBSession):
    """
    Super Admin endpoint returning global multi-tenant platform metrics:
    - Total registered, active, and pending companies
    - Total jobs (active vs closed)
    - Total candidates & applications
    - Total voice AI screening calls
    """
    from app.models.tenant import Tenant
    from app.models.recruiter_call import RecruiterCall
    from sqlalchemy import text

    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

    # Tenants
    t_res = await db.execute(select(Tenant))
    tenants = t_res.scalars().all()
    total_companies = len(tenants)
    active_companies = len([t for t in tenants if t.status == "active"])
    pending_companies = len([t for t in tenants if t.status == "pending_setup"])

    # Jobs
    j_res = await db.execute(select(Job))
    jobs = j_res.scalars().all()
    total_jobs = len(jobs)
    active_jobs = len([j for j in jobs if j.status == "PUBLISHED"])

    # Applications
    a_res = await db.execute(select(Application))
    apps = a_res.scalars().all()
    total_applications = len(apps)
    total_hires = len([a for a in apps if a.status in ("COMPLETED", "HIRED")])

    # Calls
    c_res = await db.execute(select(RecruiterCall))
    calls = c_res.scalars().all()
    total_voice_calls = len(calls)

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "pending_companies": pending_companies,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "closed_jobs": total_jobs - active_jobs,
        "total_applications": total_applications,
        "total_hires": total_hires,
        "total_voice_calls": total_voice_calls,
        "system_health": "100% Operational"
    }


