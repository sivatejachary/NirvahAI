"""
Script to seed the application with required initial data.
Run once after migrations: python -m scripts.seed
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, select
from app.core.database import AsyncSessionLocal, init_db
from app.models.user import Role, Permission
from app.core.logging import setup_logging


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


async def seed():
    setup_logging()
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # Bypass RLS for seeding
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        
        # Seed permissions
        for name, resource, action, description in PERMISSIONS:
            existing = await db.execute(select(Permission).where(Permission.name == name))
            if not existing.scalar_one_or_none():
                db.add(Permission(name=name, resource=resource, action=action, description=description))
        
        await db.commit()
        print("✓ Permissions seeded successfully")
        print("✓ System roles were seeded in migration 0001")
        print("✓ Database ready for use")


if __name__ == "__main__":
    asyncio.run(seed())
