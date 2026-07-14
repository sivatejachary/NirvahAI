import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import tenant, user

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

ROLES = [
    {"name": "platform_admin", "display_name": "Platform Administrator", "is_system_role": True},
    {"name": "tenant_admin", "display_name": "Company Administrator", "is_system_role": True},
    {"name": "hr_manager", "display_name": "HR Manager", "is_system_role": True},
    {"name": "hr_recruiter", "display_name": "Recruiter", "is_system_role": True},
    {"name": "hiring_manager", "display_name": "Hiring Manager", "is_system_role": True},
    {"name": "interviewer", "display_name": "Interviewer", "is_system_role": True},
    {"name": "employee", "display_name": "Employee", "is_system_role": True},
]

async def seed():
    print("Beginning database seeding...")
    async with AsyncSessionLocal() as db:
        # Bypass RLS
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
            
        # Flush to generate IDs
        await db.flush()
        
        # Assign permissions to roles via direct SQL inserts to avoid lazy load Greenlet errors
        print("Assigning permissions to roles via direct SQL...")
        for perm in perm_objs:
            await db.execute(
                text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)"),
                {"rid": role_objs["tenant_admin"].id, "pid": perm.id}
            )
            await db.execute(
                text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)"),
                {"rid": role_objs["hr_manager"].id, "pid": perm.id}
            )
        
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
        db.add(admin_user)
        await db.flush()
        
        # Assign roles to admin user via direct SQL
        print("Assigning roles to admin user via direct SQL...")
        await db.execute(
            text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
            {"uid": admin_user.id, "rid": role_objs["tenant_admin"].id}
        )
        await db.execute(
            text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
            {"uid": admin_user.id, "rid": role_objs["hr_manager"].id}
        )
        
        # Seed company settings and wizard state
        print("Seeding company settings...")
        settings_obj = tenant.CompanySettings(
            tenant_id=new_tenant.id
        )
        db.add(settings_obj)
        
        print("Seeding setup wizard state...")
        from app.models.company import SetupWizardState
        from datetime import datetime
        wizard_obj = SetupWizardState(
            tenant_id=new_tenant.id,
            step_company_profile=True,
            step_offices=True,
            step_departments=True,
            step_hiring_rules=True,
            step_compliance=True,
            step_email_integration=True,
            step_calendar_integration=True,
            step_sandbox_test=True,
            completed_at=datetime.utcnow(),
            activated_at=datetime.utcnow(),
            current_step=8
        )
        db.add(wizard_obj)
        
        await db.commit()
        print("SUCCESS: Database seeding complete! Ready for use.")

if __name__ == "__main__":
    asyncio.run(seed())
