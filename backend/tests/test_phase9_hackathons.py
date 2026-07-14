"""
Phase 9 Integration Tests: Hackathon Evaluator & Code Defense Portal
Verifies unauthenticated codebase submission uploads, code defense questions, and RLS gates.
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
    slug = f"hac-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_hackathon_and_code_defense_lifecycle(client: AsyncClient):
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
            "description": "Evaluate architectural patterns.",
            "department_id": dept_id,
            "requirements": ["Python", "Docker"]
        }
    )
    job_id = job_resp.json()["id"]

    # 2. Setup Consent & Application Ingestion
    cand_email = "hackathon@example.com"
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
            "candidate_name": "Expert Hacker",
            "candidate_email": cand_email,
            "resume_text": "Experienced Systems Hacker."
        }
    )
    app_id = app_resp.json()["id"]

    # 3. Submit hackathon repository snapshot
    code_snapshot = (
        "def run_server():\n"
        "    pool = CustomConnectionPool(max_size=10)\n"
        "    return pool.connect()\n"
    )
    sub_resp = await client.post(
        "/api/v1/public/hackathons/submissions",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "application_id": app_id,
            "code_snapshot": code_snapshot,
            "repo_url": "https://github.com/hacker/solution"
        }
    )
    assert sub_resp.status_code == 201
    submission_id = sub_resp.json()["submission_id"]
    assert sub_resp.json()["status"] == "EVALUATING"
    assert "architecture_score" in sub_resp.json()

    # 4. Fetch custom Code Defense Question
    q_resp = await client.get(
        f"/api/v1/public/hackathons/defense/{submission_id}",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert q_resp.status_code == 200
    assert len(q_resp.json()["defense_question"]) > 0

    # 5. Submit candidate defense explanation
    def_resp = await client.post(
        f"/api/v1/public/hackathons/defense/{submission_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_explanation": "I implemented custom pooling to minimize thread locking overheads on highly concurrent queries."}
    )
    assert def_resp.status_code == 200
    assert def_resp.json()["plagiarism_risk"] == "LOW"
    assert def_resp.json()["defense_score"] >= 60.0

    # 6. Verify application promoted to OFFER_STAGE
    app_details = await client.get(
        f"/api/v1/applications/{app_id}",
        headers=_auth(t["token"])
    )
    assert app_details.status_code == 200
    assert app_details.json()["status"] == "OFFER_STAGE"
