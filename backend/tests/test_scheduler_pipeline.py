"""
Phase 11 Integration Tests: Geolocation Proximity and Skill Scheduler Match Routing
Verifies slots filtering by interviewer skills and location boost, non-overlapping free-busy check, and bookings reservation.
"""
import pytest
import uuid
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
        yield c


async def _setup_tenant(client: AsyncClient, slug_suffix: str = "") -> dict:
    """Create a tenant and return credentials."""
    slug = f"sch-{uuid.uuid4().hex[:6]}{slug_suffix}"
    email = f"admin@{slug}.com"
    await client.post("/api/v1/auth/register", json={
        "company_name": f"Company {slug}",
        "company_slug": slug,
        "admin_full_name": "Admin",
        "admin_email": email,
        "admin_password": "StrongPass123!",
    })
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "StrongPass123!", "tenant_slug": slug,
    })
    data = login.json()
    
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        user_stmt = select(User).where(User.email == email)
        user = (await session.execute(user_stmt)).scalar_one()
        user_id = str(user.id)

    return {
        "token": data["access_token"],
        "tenant_id": data["tenant_id"],
        "email": email,
        "slug": slug,
        "user_id": user_id
    }


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_scheduler_routing_and_booking_lifecycle(client: AsyncClient):
    t = await _setup_tenant(client)

    # 1. Setup Office & Department
    off_resp = await client.post(
        "/api/v1/company/offices",
        headers=_auth(t["token"]),
        json={
            "name": "San Francisco Headquarters",
            "address_line1": "123 Market St",
            "city": "San Francisco",
            "country": "US",
            "time_zone": "America/Los_Angeles"
        }
    )
    office_id = off_resp.json()["id"]

    dept_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t["token"]),
        json={"name": "Engineering"}
    )
    dept_id = dept_resp.json()["id"]

    # 2. Setup Job & Application Ingestion
    job_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t["token"]),
        json={
            "title": "Senior Go Engineer",
            "description": "Must know Go, Kubernetes.",
            "department_id": dept_id,
            "requirements": ["Go", "Kubernetes"]
        }
    )
    job_id = job_resp.json()["id"]

    cand_email = "gopher@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)

    consent_resp = await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "VOICE_CALL", "consent_status": True}
    )
    assert consent_resp.status_code == 200, f"Consent failed: {consent_resp.status_code} - {consent_resp.text}"

    app_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "Pro Gopher",
            "candidate_email": cand_email,
            "resume_text": "Experienced Go and Kubernetes architect."
        }
    )
    app_id = app_resp.json()["id"]

    # 3. Register Interviewer Weekly available schedules
    # Simulates interviewer mapping skills and slots
    # We will seed direct schedule record in DB using test dependencies
    # Wait, can we write a direct mock route or insert inside conftest?
    # Better, we can use dependency session database to add schedules
    from app.core.database import AsyncSessionLocal
    from app.models.scheduler import InterviewerSchedule

    async with AsyncSessionLocal() as session:
        # Seeding scheduler
        sched = InterviewerSchedule(
            tenant_id=uuid.UUID(t["tenant_id"]),
            user_id=uuid.UUID(t["user_id"]),
            office_id=uuid.UUID(office_id),
            skills={"skills": ["Go", "Kubernetes"]},
            available_slots={"slots": ["2026-07-20T10:00:00", "2026-07-20T14:00:00"]}
        )
        session.add(sched)
        await session.commit()
        sched_id = str(sched.id)

    # 4. Fetch available slots matching geographical proximity and skills tags
    slots_resp = await client.get(
        f"/api/v1/public/scheduler/slots/{app_id}",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert slots_resp.status_code == 200
    slots = slots_resp.json()["slots"]
    assert len(slots) > 0
    # Sanity checks
    assert slots[0]["interviewer_id"] == sched_id
    assert slots[0]["is_local_proximity"] is True
    assert "go" in slots[0]["matching_skills"]

    # 5. Create calendar interview booking reservation
    book_resp = await client.post(
        "/api/v1/public/scheduler/bookings",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "application_id": app_id,
            "interviewer_id": sched_id,
            "start_time": "2026-07-20T10:00:00"
        }
    )
    assert book_resp.status_code == 201
    assert "booking_id" in book_resp.json()
    assert "meeting_link" in book_resp.json()

    # 6. Verify non-overlapping slots removal (overlap 10:00 slot is removed, 14:00 remains)
    slots_after = await client.get(
        f"/api/v1/public/scheduler/slots/{app_id}",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert slots_after.status_code == 200
    rem_slots = slots_after.json()["slots"]
    # Check that booked 10:00 slot is filtered and only 14:00 slot remains
    assert len(rem_slots) == 1
    assert rem_slots[0]["start_time"] == "2026-07-20T14:00:00"
