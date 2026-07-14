"""
Company Service — Phase 1
Handles: settings, offices, departments, teams, setup wizard state.
All operations are tenant-scoped. No cross-tenant access possible.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import CompanySettings, CompanyOffice, Department, Tenant
from app.models.company import Team, SetupWizardState
from app.core.logging import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


# ── Company Settings ──────────────────────────────────────────────────────────

async def get_company_settings(db: AsyncSession, tenant_id: str) -> Optional[CompanySettings]:
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def upsert_company_settings(
    db: AsyncSession,
    tenant_id: str,
    **kwargs,
) -> CompanySettings:
    settings = await get_company_settings(db, tenant_id)
    if not settings:
        settings = CompanySettings(tenant_id=uuid.UUID(tenant_id), **kwargs)
        db.add(settings)
    else:
        for key, value in kwargs.items():
            if hasattr(settings, key) and value is not None:
                setattr(settings, key, value)
    return settings


# ── Setup Wizard ──────────────────────────────────────────────────────────────

async def get_or_create_wizard_state(
    db: AsyncSession, tenant_id: str
) -> SetupWizardState:
    result = await db.execute(
        select(SetupWizardState).where(
            SetupWizardState.tenant_id == uuid.UUID(tenant_id)
        )
    )
    state = result.scalar_one_or_none()
    if not state:
        state = SetupWizardState(tenant_id=uuid.UUID(tenant_id))
        db.add(state)
        await db.flush()
    return state


async def complete_wizard_step(
    db: AsyncSession,
    tenant_id: str,
    step_field: str,
) -> SetupWizardState:
    state = await get_or_create_wizard_state(db, tenant_id)
    if hasattr(state, step_field):
        setattr(state, step_field, True)
    if state.is_complete and state.completed_at is None:
        state.completed_at = _utcnow()
    return state


# ── Offices ───────────────────────────────────────────────────────────────────

async def list_offices(db: AsyncSession, tenant_id: str) -> list[CompanyOffice]:
    result = await db.execute(
        select(CompanyOffice)
        .where(CompanyOffice.tenant_id == uuid.UUID(tenant_id))
        .order_by(CompanyOffice.name)
    )
    return list(result.scalars().all())


async def get_office(
    db: AsyncSession, tenant_id: str, office_id: str
) -> Optional[CompanyOffice]:
    result = await db.execute(
        select(CompanyOffice).where(
            CompanyOffice.id == uuid.UUID(office_id),
            CompanyOffice.tenant_id == uuid.UUID(tenant_id),
        )
    )
    return result.scalar_one_or_none()


async def create_office(
    db: AsyncSession,
    tenant_id: str,
    **kwargs,
) -> CompanyOffice:
    office = CompanyOffice(tenant_id=uuid.UUID(tenant_id), **kwargs)
    db.add(office)
    await db.flush()
    return office


async def update_office(
    db: AsyncSession,
    tenant_id: str,
    office_id: str,
    **kwargs,
) -> Optional[CompanyOffice]:
    office = await get_office(db, tenant_id, office_id)
    if not office:
        return None
    for k, v in kwargs.items():
        if hasattr(office, k) and v is not None:
            setattr(office, k, v)
    return office


async def delete_office(
    db: AsyncSession, tenant_id: str, office_id: str
) -> bool:
    office = await get_office(db, tenant_id, office_id)
    if not office:
        return False
    await db.delete(office)
    return True


# ── Departments ───────────────────────────────────────────────────────────────

async def list_departments(
    db: AsyncSession, tenant_id: str, parent_id: Optional[str] = None
) -> list[Department]:
    q = select(Department).where(
        Department.tenant_id == uuid.UUID(tenant_id),
        Department.is_active == True,
    )
    if parent_id:
        q = q.where(Department.parent_department_id == uuid.UUID(parent_id))
    else:
        q = q.where(Department.parent_department_id == None)
    result = await db.execute(q.order_by(Department.name))
    return list(result.scalars().all())


async def get_department(
    db: AsyncSession, tenant_id: str, dept_id: str
) -> Optional[Department]:
    result = await db.execute(
        select(Department).where(
            Department.id == uuid.UUID(dept_id),
            Department.tenant_id == uuid.UUID(tenant_id),
        )
    )
    return result.scalar_one_or_none()


async def create_department(
    db: AsyncSession,
    tenant_id: str,
    name: str,
    description: Optional[str] = None,
    parent_id: Optional[str] = None,
) -> Department:
    dept = Department(
        tenant_id=uuid.UUID(tenant_id),
        name=name,
        description=description,
        parent_department_id=uuid.UUID(parent_id) if parent_id else None,
    )
    db.add(dept)
    await db.flush()
    return dept


async def update_department(
    db: AsyncSession,
    tenant_id: str,
    dept_id: str,
    **kwargs,
) -> Optional[Department]:
    dept = await get_department(db, tenant_id, dept_id)
    if not dept:
        return None
    for k, v in kwargs.items():
        if hasattr(dept, k):
            setattr(dept, k, v)
    return dept


# ── Teams ─────────────────────────────────────────────────────────────────────

async def list_teams(
    db: AsyncSession, tenant_id: str, department_id: Optional[str] = None
) -> list[Team]:
    q = select(Team).where(Team.tenant_id == uuid.UUID(tenant_id))
    if department_id:
        q = q.where(Team.department_id == uuid.UUID(department_id))
    result = await db.execute(q.order_by(Team.name))
    return list(result.scalars().all())


async def get_team(
    db: AsyncSession, tenant_id: str, team_id: str
) -> Optional[Team]:
    result = await db.execute(
        select(Team).where(
            Team.id == uuid.UUID(team_id),
            Team.tenant_id == uuid.UUID(tenant_id),
        )
    )
    return result.scalar_one_or_none()


async def create_team(
    db: AsyncSession,
    tenant_id: str,
    department_id: str,
    name: str,
    description: Optional[str] = None,
    headcount_target: Optional[int] = None,
    team_lead_user_id: Optional[str] = None,
) -> Team:
    team = Team(
        tenant_id=uuid.UUID(tenant_id),
        department_id=uuid.UUID(department_id),
        name=name,
        description=description,
        headcount_target=headcount_target,
        team_lead_user_id=uuid.UUID(team_lead_user_id) if team_lead_user_id else None,
    )
    db.add(team)
    await db.flush()
    return team
