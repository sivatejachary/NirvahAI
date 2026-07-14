"""
Company Settings & Setup Wizard API — Phase 1
"""
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services import company as company_svc
from app.services.audit import AuditService

router = APIRouter(prefix="/company", tags=["Company"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    email_domain: Optional[str] = None
    headquarters_country: Optional[str] = None
    headquarters_city: Optional[str] = None
    operating_countries: Optional[list[str]] = None
    hiring_countries: Optional[list[str]] = None
    time_zones: Optional[list[str]] = None


class HiringRulesUpdate(BaseModel):
    autonomy_level: Optional[str] = None
    notice_period_days_default: Optional[int] = None
    offer_approval_required: Optional[bool] = None
    background_verification_required: Optional[bool] = None
    proctoring_enabled: Optional[bool] = None
    ai_interview_enabled: Optional[bool] = None
    voice_calls_enabled: Optional[bool] = None
    recruiter_display_name: Optional[str] = None
    sender_email: Optional[str] = None
    daily_ai_budget_usd: Optional[float] = None
    monthly_ai_budget_usd: Optional[float] = None


class OfficeCreate(BaseModel):
    name: str
    city: str
    country: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    time_zone: Optional[str] = None
    maps_url: Optional[str] = None


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    time_zone: Optional[str] = None
    maps_url: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TeamCreate(BaseModel):
    department_id: str
    name: str
    description: Optional[str] = None
    headcount_target: Optional[int] = None
    team_lead_user_id: Optional[str] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    headcount_target: Optional[int] = None
    team_lead_user_id: Optional[str] = None
    is_active: Optional[bool] = None


# ── Setup Wizard ──────────────────────────────────────────────────────────────

@router.get("/wizard", summary="Get setup wizard state")
async def get_wizard_state(tenant_id: TenantId, db: DBSession):
    state = await company_svc.get_or_create_wizard_state(db, tenant_id)
    return {
        "current_step": state.current_step,
        "completion_percentage": state.completion_percentage,
        "is_complete": state.is_complete,
        "completed_at": state.completed_at,
        "steps": {
            "company_profile": state.step_company_profile,
            "offices": state.step_offices,
            "departments": state.step_departments,
            "hiring_rules": state.step_hiring_rules,
            "compliance": state.step_compliance,
            "email_integration": state.step_email_integration,
            "calendar_integration": state.step_calendar_integration,
            "sandbox_test": state.step_sandbox_test,
        },
    }


# ── Company Profile ───────────────────────────────────────────────────────────

@router.get("/profile", summary="Get company profile")
async def get_company_profile(
    tenant_id: TenantId,
    db: DBSession,
):
    from sqlalchemy import select
    from app.models.tenant import Tenant, CompanySettings
    import uuid

    t_result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = t_result.scalar_one_or_none()
    settings = await company_svc.get_company_settings(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    return {
        "company_name": tenant.company_name,
        "company_slug": tenant.company_slug,
        "legal_name": tenant.legal_name,
        "industry": tenant.industry,
        "company_size": tenant.company_size,
        "website": tenant.website,
        "email_domain": tenant.email_domain,
        "status": tenant.status,
        "is_sandbox": tenant.is_sandbox,
        "plan": tenant.plan,
        "headquarters_country": settings.headquarters_country if settings else None,
        "headquarters_city": settings.headquarters_city if settings else None,
        "operating_countries": settings.operating_countries if settings else [],
        "hiring_countries": settings.hiring_countries if settings else [],
        "time_zones": settings.time_zones if settings else [],
    }


@router.patch(
    "/profile",
    summary="Update company profile",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def update_company_profile(
    body: CompanyProfileUpdate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    from sqlalchemy import select
    from app.models.tenant import Tenant
    import uuid

    t_result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = t_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    # Update Tenant fields
    if body.company_name:
        tenant.company_name = body.company_name
    if body.legal_name is not None:
        tenant.legal_name = body.legal_name
    if body.industry is not None:
        tenant.industry = body.industry
    if body.company_size is not None:
        tenant.company_size = body.company_size
    if body.website is not None:
        tenant.website = body.website
    if body.email_domain is not None:
        tenant.email_domain = body.email_domain

    # Update CompanySettings fields
    settings_kwargs = {
        k: v for k, v in {
            "headquarters_country": body.headquarters_country,
            "headquarters_city": body.headquarters_city,
            "operating_countries": body.operating_countries,
            "hiring_countries": body.hiring_countries,
            "time_zones": body.time_zones,
        }.items() if v is not None
    }
    if settings_kwargs:
        await company_svc.upsert_company_settings(db, tenant_id, **settings_kwargs)

    # Mark wizard step complete
    await company_svc.complete_wizard_step(db, tenant_id, "step_company_profile")

    audit = AuditService(db)
    await audit.log(
        action="company.profile_updated",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="tenant",
        entity_id=tenant_id,
        reason_code="COMPANY_PROFILE_UPDATE",
    )

    return {"message": "Company profile updated."}


@router.patch(
    "/hiring-rules",
    summary="Update hiring rules and autonomy",
    dependencies=[Depends(require_role("tenant_admin"))],
)
async def update_hiring_rules(
    body: HiringRulesUpdate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    if body.autonomy_level and body.autonomy_level not in {
        "ASSISTED", "SEMI_AUTONOMOUS", "AUTONOMOUS"
    }:
        raise HTTPException(status_code=422, detail="Invalid autonomy_level.")

    kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
    settings = await company_svc.upsert_company_settings(db, tenant_id, **kwargs)

    await company_svc.complete_wizard_step(db, tenant_id, "step_hiring_rules")

    audit = AuditService(db)
    await audit.log(
        action="company.hiring_rules_updated",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="company_settings",
        reason_code="HIRING_RULES_UPDATE",
        output_summary=kwargs,
    )
    return {"message": "Hiring rules updated.", "autonomy_level": settings.autonomy_level}


# ── Offices ───────────────────────────────────────────────────────────────────

@router.get("/offices", summary="List all company offices")
async def list_offices(tenant_id: TenantId, db: DBSession):
    offices = await company_svc.list_offices(db, tenant_id)
    return [
        {
            "id": str(o.id), "name": o.name, "city": o.city, "country": o.country,
            "address_line1": o.address_line1, "address_line2": o.address_line2,
            "state": o.state, "postal_code": o.postal_code,
            "time_zone": o.time_zone, "maps_url": o.maps_url, "is_active": o.is_active,
        }
        for o in offices
    ]


@router.post(
    "/offices",
    status_code=status.HTTP_201_CREATED,
    summary="Create an office location",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def create_office(
    body: OfficeCreate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    office = await company_svc.create_office(db, tenant_id, **body.model_dump())
    await company_svc.complete_wizard_step(db, tenant_id, "step_offices")

    audit = AuditService(db)
    await audit.log(
        action="office.created",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="company_office",
        entity_id=str(office.id),
        reason_code="OFFICE_CREATED",
        output_summary={"name": office.name, "city": office.city},
    )
    return {"id": str(office.id), "name": office.name, "city": office.city, "country": office.country}


@router.patch(
    "/offices/{office_id}",
    summary="Update an office",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def update_office(
    office_id: str,
    body: OfficeUpdate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
    office = await company_svc.update_office(db, tenant_id, office_id, **kwargs)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found.")
    return {"message": "Office updated.", "id": str(office.id)}


@router.delete(
    "/offices/{office_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("tenant_admin"))],
)
async def delete_office(office_id: str, tenant_id: TenantId, db: DBSession):
    deleted = await company_svc.delete_office(db, tenant_id, office_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Office not found.")


# ── Departments ───────────────────────────────────────────────────────────────

@router.get("/departments", summary="List departments (tree-aware)")
async def list_departments(
    tenant_id: TenantId,
    db: DBSession,
    parent_id: Optional[str] = None,
):
    depts = await company_svc.list_departments(db, tenant_id, parent_id)
    return [
        {
            "id": str(d.id), "name": d.name, "description": d.description,
            "parent_department_id": str(d.parent_department_id) if d.parent_department_id else None,
            "is_active": d.is_active,
        }
        for d in depts
    ]


@router.post(
    "/departments",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def create_department(
    body: DepartmentCreate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    dept = await company_svc.create_department(
        db, tenant_id, body.name, body.description, body.parent_id
    )
    await company_svc.complete_wizard_step(db, tenant_id, "step_departments")

    audit = AuditService(db)
    await audit.log(
        action="department.created",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="department",
        entity_id=str(dept.id),
        reason_code="DEPARTMENT_CREATED",
    )
    return {"id": str(dept.id), "name": dept.name}


@router.patch(
    "/departments/{dept_id}",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def update_department(
    dept_id: str,
    body: DepartmentUpdate,
    tenant_id: TenantId,
    db: DBSession,
):
    kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
    dept = await company_svc.update_department(db, tenant_id, dept_id, **kwargs)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")
    return {"message": "Department updated.", "id": str(dept.id)}


# ── Teams ─────────────────────────────────────────────────────────────────────

@router.get("/teams", summary="List teams")
async def list_teams(
    tenant_id: TenantId,
    db: DBSession,
    department_id: Optional[str] = None,
):
    teams = await company_svc.list_teams(db, tenant_id, department_id)
    return [
        {
            "id": str(t.id), "name": t.name, "description": t.description,
            "department_id": str(t.department_id),
            "headcount_target": t.headcount_target, "is_active": t.is_active,
        }
        for t in teams
    ]


@router.post(
    "/teams",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def create_team(
    body: TeamCreate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    # Verify department belongs to this tenant
    dept = await company_svc.get_department(db, tenant_id, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found in this tenant.")

    team = await company_svc.create_team(
        db, tenant_id, body.department_id, body.name,
        body.description, body.headcount_target, body.team_lead_user_id,
    )
    audit = AuditService(db)
    await audit.log(
        action="team.created",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="team",
        entity_id=str(team.id),
        reason_code="TEAM_CREATED",
    )
    return {"id": str(team.id), "name": team.name}
