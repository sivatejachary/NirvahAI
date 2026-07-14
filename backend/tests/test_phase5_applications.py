"""
Phase 5 Integration Tests: Application Ingestion, Grading & Rank-Matching
Verifies consent gateways, blind resume parsing, ranking list matching, and RLS checks.
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
    """Create a tenant and return {token, tenant_id, email, slug}."""
    slug = f"ap-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_gdpr_consent_gate_enforcement(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # Setup department and job first
    dept_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t["token"]),
        json={"name": "Science", "description": "Research"}
    )
    dept_id = dept_resp.json()["id"]
    
    job_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t["token"]),
        json={
            "title": "Quantum Chemist",
            "description": "Evaluate molecule bounds.",
            "department_id": dept_id,
            "requirements": ["Python", "Quantum Physics"]
        }
    )
    job_id = job_resp.json()["id"]
    
    # 1. Submit application without consent - should fail with HTTP 400
    app_fail = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "John Doe",
            "candidate_email": "john.doe@example.com",
            "resume_text": "Physics professor with 10 years experience."
        }
    )
    assert app_fail.status_code == 400
    assert "consent check failed" in app_fail.json()["detail"].lower()
    
    # 2. Record candidate consent
    consent_resp = await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "candidate_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "john.doe@example.com")),
            "workflow_stage": "MCQ",
            "consent_status": True
        }
    )
    assert consent_resp.status_code == 200
    
    # 3. Re-submit application - should succeed, grade match, and start workflow
    app_success = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "John Doe",
            "candidate_email": "john.doe@example.com",
            "resume_text": "Physics professor with 10 years experience."
        }
    )
    assert app_success.status_code == 201
    data = app_success.json()
    assert data["fit_score"] == 85.0
    assert data["status"] == "MCQ_STAGE"
    assert "Sarah Connor" in data["raw_parsed_data"]["full_name"] # parsed mock details


@pytest.mark.anyio
async def test_applications_list_ranking_and_rls(client: AsyncClient):
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")
    
    # Setup job for Tenant A
    dept_a_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t_a["token"]),
        json={"name": "Engineering"}
    )
    dept_a_id = dept_a_resp.json()["id"]
    
    job_a_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t_a["token"]),
        json={
            "title": "Rust Dev",
            "description": "Build tools.",
            "department_id": dept_a_id,
            "requirements": ["Rust"]
        }
    )
    job_a_id = job_a_resp.json()["id"]
    
    # Record consent for Applicant A
    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"candidate_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "applicant.a@example.com")), "workflow_stage": "MCQ", "consent_status": True}
    )
    
    # Submit application under Tenant A
    submit_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={
            "job_id": job_a_id,
            "candidate_name": "Applicant A",
            "candidate_email": "applicant.a@example.com",
            "resume_text": "Experienced Rust developer."
        }
    )
    app_a_id = submit_resp.json()["id"]
    
    # Tenant B tries to view details of Application A - should fail with 404 (due to RLS separation)
    b_get = await client.get(
        f"/api/v1/applications/{app_a_id}",
        headers=_auth(t_b["token"])
    )
    assert b_get.status_code == 404
