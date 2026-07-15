import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.core.database import Base, AsyncSessionLocal
from app.core.security import hash_password

# Import all models to register them on Base.metadata
from app.models import (
    audit, tenant, user, company, compliance, ai,
    workflow, job, application, assessment, challenge,
    interview, hackathon, recruiter_call, scheduler,
    bgv, meeting, hr_chat, offboarding, onboarding,
    offer, performance, selection, warning_letter
)

# Permissions list
PERMISSIONS = [
    ("jobs:create", "jobs", "create", "Create new job postings"),
    ("jobs:read", "jobs", "read", "View job postings"),
    ("jobs:update", "jobs", "update", "Edit job postings"),
    ("jobs:delete", "jobs", "delete", "Delete job postings"),
    ("candidates:read", "candidates", "read", "View candidate profiles"),
    ("candidates:manage", "candidates", "manage", "Manage candidate pipeline"),
    ("assessments:read", "assessments", "read", "View assessment results"),
    ("assessments:manage", "assessments", "manage", "Manage assessments"),
    ("interviews:read", "interviews", "read", "View interviews"),
    ("interviews:manage", "interviews", "manage", "Schedule and manage interviews"),
    ("offers:create", "offers", "create", "Create and send offers"),
    ("offers:read", "offers", "read", "View offers"),
    ("offers:approve", "offers", "approve", "Approve offers before sending"),
    ("employees:read", "employees", "read", "View employee records"),
    ("employees:manage", "employees", "manage", "Manage employee data"),
    ("audit:read", "audit", "read", "View audit logs"),
    ("settings:manage", "settings", "manage", "Manage company settings"),
    ("tenants:read", "tenants", "read", "View tenant information"),
    ("tenants:create", "tenants", "create", "Create new tenants"),
]

# System roles
ROLES = [
    {"name": "platform_admin", "display_name": "Platform Administrator", "is_system_role": True},
    {"name": "tenant_admin", "display_name": "Company Administrator", "is_system_role": True},
    {"name": "hr_manager", "display_name": "HR Manager", "is_system_role": True},
    {"name": "hr_recruiter", "display_name": "Recruiter", "is_system_role": True},
    {"name": "hiring_manager", "display_name": "Hiring Manager", "is_system_role": True},
    {"name": "interviewer", "display_name": "Interviewer", "is_system_role": True},
    {"name": "employee", "display_name": "Employee", "is_system_role": True},
]

async def recreate_and_seed():
    print(f"Connecting to database: {settings.DATABASE_URL}")
    
    # Use standard engine for schema operations with SQL logging enabled
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Dropping existing tables and views...")
        # Execute each schema statement separately for asyncpg compatibility
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        await conn.execute(text("COMMENT ON SCHEMA public IS 'standard public schema'"))
        print("Recreating database tables brand new...")
        await conn.run_sync(Base.metadata.create_all)
        print("[OK] All tables created successfully!")
        
    # 2. Seed roles, permissions, tenant, and admin user
    print("Beginning database seeding...")
    async with AsyncSessionLocal() as db:
        # Disable RLS bypass flag in session state if needed, or bypass it directly
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        
        # Add roles
        print("Seeding system roles...")
        role_objs = {}
        for r in ROLES:
            role = user.Role(
                name=r["name"],
                display_name=r["display_name"],
                is_system_role=r["is_system_role"]
            )
            db.add(role)
            role_objs[r["name"]] = role
        
        # Add permissions
        print("Seeding permissions...")
        perm_objs = []
        for name, resource, action, description in PERMISSIONS:
            perm = user.Permission(
                name=name,
                resource=resource,
                action=action,
                description=description
            )
            db.add(perm)
            perm_objs.append(perm)
            
        # Assign permissions to tenant_admin, hr_manager, etc.
        # Allow all permissions to tenant_admin and hr_manager
        print("Assigning permissions to roles...")
        role_objs["tenant_admin"].permissions = perm_objs
        role_objs["hr_manager"].permissions = perm_objs

        # Flush to generate IDs
        print("Flushing roles and permissions...")
        await db.flush()
        
        # Seed default tenant
        print("Seeding default tenant (dev-tenant)...")
        new_tenant = tenant.Tenant(
            company_name="Dev Tenant",
            company_slug="dev-tenant",
            status="active"
        )
        db.add(new_tenant)
        await db.flush()
        
        # Seed default admin user
        print("Seeding admin user (admin@dev-tenant.com)...")
        admin_pass_hash = hash_password("StrongPass123!")
        admin_user = user.User(
            tenant_id=new_tenant.id,
            email="admin@dev-tenant.com",
            password_hash=admin_pass_hash,
            full_name="Admin User",
            status="active"
        )
        admin_user.roles = [role_objs["tenant_admin"], role_objs["hr_manager"]]
        db.add(admin_user)
        
        # Seed initial company settings and setup wizard state
        print("Seeding default company settings and setup wizard state...")
        from datetime import datetime, timezone
        settings_obj = tenant.CompanySettings(
            tenant_id=new_tenant.id,
            autonomy_level="ASSISTED"
        )
        db.add(settings_obj)
        
        wizard_obj = company.SetupWizardState(
            tenant_id=new_tenant.id,
            step_company_profile=True,
            step_offices=True,
            step_departments=True,
            step_hiring_rules=True,
            step_compliance=True,
            step_email_integration=True,
            step_calendar_integration=True,
            step_sandbox_test=True,
            completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
            activated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(wizard_obj)
        
        # Commit all seeded data
        print("Committing transaction...")
        await db.commit()
        print("SUCCESS: Database seeding complete! Ready for use.")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(recreate_and_seed())
