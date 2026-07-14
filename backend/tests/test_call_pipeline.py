"""
Phase 10 Integration Tests: Recruiter Call Logic, Disclosures & Audio Streaming
Verifies outbound dialer starts, privacy disclosures logs, real-time message stream memory, and call summaries.
"""
import pytest
import uuid
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
    slug = f"cal-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
    return {"token": data["access_token"], "tenant_id": data["tenant_id"], "email": email, "slug": slug}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_recruiter_call_lifecycle(client: AsyncClient):
    t = await _setup_tenant(client)

    # 1. Setup Department & Job
    dept_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t["token"]),
        json={"name": "Engineering"}
    )
    dept_id = dept_resp.json()["id"]

    job_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t["token"]),
        json={
            "title": "Principal Architect",
            "description": "Outbound call logic check.",
            "department_id": dept_id,
            "requirements": ["Go", "Docker"]
        }
    )
    job_id = job_resp.json()["id"]

    # 2. Setup Consent & Application Ingestion
    cand_email = "caller@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)

    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "VOICE_CALL", "consent_status": True}
    )

    app_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "Senior Dialer",
            "candidate_email": cand_email,
            "resume_text": "Experienced Docker engineer."
        }
    )
    app_id = app_resp.json()["id"]

    # 3. Start phone call session
    start_resp = await client.post(
        "/api/v1/public/calls/start",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"application_id": app_id}
    )
    assert start_resp.status_code == 201
    call_id = start_resp.json()["call_id"]
    assert start_resp.json()["status"] == "CONNECTED"
    # Verify mandatory recording disclosure is in greeting message
    assert "recorded" in start_resp.json()["greeting_message"] or "transcribed" in start_resp.json()["greeting_message"]

    # 4. Stream progressive transcription message
    msg_resp = await client.post(
        f"/api/v1/public/calls/{call_id}/stream",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"message_text": "Yes, I am ready. I build Go microservices and manage Docker deployments daily."}
    )
    assert msg_resp.status_code == 200
    assert msg_resp.json()["sender"] == "AGENT"
    assert len(msg_resp.json()["message_text"]) > 0

    # 5. Disconnect call session
    disc_resp = await client.post(
        f"/api/v1/public/calls/{call_id}/disconnect",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert disc_resp.status_code == 200
    assert disc_resp.json()["status"] == "DISCONNECTED"
    assert "duration_seconds" in disc_resp.json()
    assert len(disc_resp.json()["summary"]) > 0
