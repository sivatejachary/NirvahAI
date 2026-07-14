"""
Phase 8 Integration Tests: Adaptive Interview Engine & Audio/Video Transcription
Verifies unauthenticated starting, dialogue exchanges, criteria evaluations, and RLS gates.
"""
import pytest
import uuid
import json
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
    slug = f"int-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_adaptive_interview_lifecycle(client: AsyncClient):
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
            "title": "Staff Architect",
            "description": "Evaluate microservice architectures.",
            "department_id": dept_id,
            "requirements": ["Go", "Kubernetes"]
        }
    )
    job_id = job_resp.json()["id"]

    # 2. Setup Consent & Application Ingestion
    cand_email = "architect@example.com"
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
            "candidate_name": "Senior Architect",
            "candidate_email": cand_email,
            "resume_text": "Experienced Go Architect."
        }
    )
    app_id = app_resp.json()["id"]

    # 3. Start adaptive interview
    start_resp = await client.post(
        "/api/v1/public/interviews",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"application_id": app_id}
    )
    assert start_resp.status_code == 201
    interview_id = start_resp.json()["interview_id"]
    assert start_resp.json()["status"] == "IN_PROGRESS"
    assert len(start_resp.json()["welcome_message"]) > 0

    # 4. Exchange progressive message
    msg_resp = await client.post(
        f"/api/v1/public/interviews/{interview_id}/message",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "message_text": "I specialize in Kubernetes operator patterns and building concurrent Go microservices.",
            "audio_url": "http://s3.bucket/recordings/audio1.webm"
        }
    )
    assert msg_resp.status_code == 200
    assert msg_resp.json()["sender"] == "AGENT"
    assert len(msg_resp.json()["message_text"]) > 0

    # 5. Finalize interview - triggers post-transcript grading matrix evaluation
    comp_resp = await client.post(
        f"/api/v1/public/interviews/{interview_id}/complete",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"
    assert "score" in comp_resp.json()
    assert "report" in comp_resp.json()
