"""
Tenant Management API Router
Platform admin operations for tenant lifecycle.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.models.tenant import CompanySettings, Tenant
from app.services.audit import AuditService

router = APIRouter(prefix="/tenants", tags=["Tenants"])


class TenantSummary(BaseModel):
    id: str
    company_name: str
    company_slug: str
    status: str
    plan: str
    is_sandbox: bool

    class Config:
        from_attributes = True


class UpdateAutonomyRequest(BaseModel):
    autonomy_level: str  # ASSISTED | SEMI_AUTONOMOUS | AUTONOMOUS


@router.get("/me", response_model=TenantSummary, summary="Get current tenant details")
async def get_current_tenant(
    tenant_id: TenantId,
    db: DBSession,
    _: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    return TenantSummary(
        id=str(tenant.id),
        company_name=tenant.company_name,
        company_slug=tenant.company_slug,
        status=tenant.status,
        plan=tenant.plan,
        is_sandbox=tenant.is_sandbox,
    )


@router.patch("/me/autonomy", summary="Update tenant autonomy level")
async def update_autonomy(
    body: UpdateAutonomyRequest,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
    _: None = Depends(require_role("tenant_admin")),
):
    allowed = {"ASSISTED", "SEMI_AUTONOMOUS", "AUTONOMOUS"}
    if body.autonomy_level not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"autonomy_level must be one of {allowed}",
        )

    result = await db.execute(
        select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=404, detail="Company settings not found.")

    old_level = settings.autonomy_level
    settings.autonomy_level = body.autonomy_level

    audit = AuditService(db)
    await audit.log(
        action="tenant.autonomy_level_changed",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="company_settings",
        entity_id=str(settings.id),
        reason_code="AUTONOMY_LEVEL_UPDATE",
        input_references={"old_level": old_level},
        output_summary={"new_level": body.autonomy_level},
    )

    return {"message": "Autonomy level updated.", "autonomy_level": body.autonomy_level}


@router.post("/me/kill-switch/{switch}", summary="Activate an emergency kill switch")
async def activate_kill_switch(
    switch: str,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
    _: None = Depends(require_role("tenant_admin")),
):
    """
    Emergency kill switches for operational risk control.
    Every activation is permanently audited.
    """
    valid_switches = {
        "automated_rejections": "kill_automated_rejections",
        "proctoring": "kill_proctoring",
        "voice_calls": "kill_voice_calls",
        "all_workflows": "kill_all_workflows",
    }

    if switch not in valid_switches:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown kill switch. Valid: {list(valid_switches.keys())}",
        )

    result = await db.execute(
        select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found.")

    field = valid_switches[switch]
    setattr(settings, field, True)

    audit = AuditService(db)
    await audit.log(
        action=f"kill_switch.activated.{switch}",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="company_settings",
        entity_id=str(settings.id),
        reason_code="EMERGENCY_KILL_SWITCH",
        output_summary={"switch": switch, "activated": True},
        status="success",
    )

    return {"message": f"Kill switch '{switch}' activated.", "switch": switch, "active": True}


# ── Super Admin / Platform Admin Endpoints ─────────────────────────────────────

class TenantStatusUpdate(BaseModel):
    status: Optional[str] = None  # active | pending_setup | suspended | inactive
    plan: Optional[str] = None    # trial | growth | enterprise


@router.get("/all", dependencies=[Depends(require_role("platform_admin"))])
async def list_all_tenants(db: DBSession):
    """
    Super Admin endpoint to view all registered enterprise company tenants across the platform.
    """
    stmt = select(Tenant).order_by(Tenant.created_at.desc())
    result = await db.execute(stmt)
    tenants = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "company_name": t.company_name,
            "company_slug": t.company_slug,
            "legal_name": getattr(t, "legal_name", None),
            "industry": getattr(t, "industry", None),
            "company_size": getattr(t, "company_size", None),
            "status": t.status,
            "plan": t.plan,
            "is_sandbox": t.is_sandbox,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tenants
    ]


@router.patch("/{tenant_id}/status", dependencies=[Depends(require_role("platform_admin"))])
async def update_tenant_status(
    tenant_id: str,
    body: TenantStatusUpdate,
    user_id: CurrentUserId,
    db: DBSession,
):
    """
    Super Admin endpoint to approve, suspend, or change subscription plan of a tenant.
    """
    import uuid
    t_uuid = uuid.UUID(tenant_id)
    stmt = select(Tenant).where(Tenant.id == t_uuid)
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    if body.status:
        tenant.status = body.status
    if body.plan:
        tenant.plan = body.plan

    await db.flush()

    audit = AuditService(db)
    await audit.log(
        action="tenant.status_updated",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="tenant",
        entity_id=tenant_id,
        reason_code="SUPER_ADMIN_TENANT_UPDATE",
        output_summary={"new_status": tenant.status, "new_plan": tenant.plan},
    )

    return {"message": "Tenant updated successfully.", "id": str(tenant.id), "status": tenant.status, "plan": tenant.plan}

