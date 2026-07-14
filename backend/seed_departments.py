import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text, select
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant, Department, CompanyOffice

async def seed_departments_and_offices():
    print("Beginning seeding of departments and offices...")
    async with AsyncSessionLocal() as db:
        # Bypass RLS
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))
        
        # 1. Fetch the default tenant
        stmt = select(Tenant).where(Tenant.company_slug == "dev-tenant")
        result = await db.execute(stmt)
        dev_tenant = result.scalar_one_or_none()
        
        if not dev_tenant:
            print("ERROR: dev-tenant not found in database!")
            return
            
        print(f"Found tenant: {dev_tenant.company_name} (ID: {dev_tenant.id})")
        
        # 2. Seed departments
        DEPARTMENTS = [
            {"name": "Engineering", "description": "Software Engineering, AI/ML, and Quality Assurance Engineering"},
            {"name": "Product Management", "description": "Product strategy, roadmap, and delivery"},
            {"name": "Design", "description": "UI/UX Design, research, and creative"},
            {"name": "Human Resources", "description": "People operations, talent acquisition, and culture"},
            {"name": "Sales & Marketing", "description": "Enterprise sales, business development, and marketing campaigns"},
        ]
        
        print("Seeding departments...")
        for dept in DEPARTMENTS:
            existing = await db.execute(
                select(Department).where(
                    Department.tenant_id == dev_tenant.id,
                    Department.name == dept["name"]
                )
            )
            if not existing.scalar_one_or_none():
                new_dept = Department(
                    tenant_id=dev_tenant.id,
                    name=dept["name"],
                    description=dept["description"],
                    is_active=True
                )
                db.add(new_dept)
                print(f" - Added department: {dept['name']}")
                
        # 3. Seed offices
        OFFICES = [
            {"name": "Headquarters", "city": "San Francisco", "state": "CA", "country": "USA"},
            {"name": "Remote", "city": "Remote", "state": None, "country": "Worldwide"},
        ]
        
        print("Seeding company offices...")
        for office in OFFICES:
            existing = await db.execute(
                select(CompanyOffice).where(
                    CompanyOffice.tenant_id == dev_tenant.id,
                    CompanyOffice.name == office["name"]
                )
            )
            if not existing.scalar_one_or_none():
                new_office = CompanyOffice(
                    tenant_id=dev_tenant.id,
                    name=office["name"],
                    city=office["city"],
                    state=office["state"],
                    country=office["country"],
                    is_active=True
                )
                db.add(new_office)
                print(f" - Added office: {office['name']}")
                
        await db.commit()
        print("SUCCESS: Departments and offices seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_departments_and_offices())
