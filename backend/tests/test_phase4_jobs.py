"""
Phase 4 Integration Tests: Job Description Generation and Sourcing Channels
Verifies legal compliance gating, JD generation, and isolation of distributions.
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
    slug = f"jb-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_job_description_generation_pipeline(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # 1. Request JD generation proposal
    resp = await client.post(
        "/api/v1/jobs/generate",
        headers=_auth(t["token"]),
        json={
            "title": "Principal Rust Engineer",
            "department_name": "Core Platform",
            "skills": ["Rust", "Actix", "Tokio", "Concurrency"],
            "autonomy_level": "AUTONOMOUS"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "title" in data
    assert "description" in data
    assert "Rust" in data["requirements"]


@pytest.mark.anyio
async def test_job_approval_and_publishing_lifecycle(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # Setup department first
    dept_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t["token"]),
        json={"name": "Engineering", "description": "Core development team"}
    )
    dept_id = dept_resp.json()["id"]
    
    # 1. Create a draft job posting
    draft_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t["token"]),
        json={
            "title": "Senior Go Developer",
            "description": "# Senior Go Developer\nBuild concurrent microservices.",
            "department_id": dept_id,
            "requirements": ["Go", "gRPC", "Docker"]
        }
    )
    assert draft_resp.status_code == 201
    job_id = draft_resp.json()["id"]
    assert draft_resp.json()["status"] == "DRAFT"
    
    # 2. Attempt to publish a draft job - should fail (must be approved first)
    pub_fail = await client.post(
        f"/api/v1/jobs/{job_id}/publish",
        headers=_auth(t["token"]),
        json={"channels": ["linkedin", "indeed"]}
    )
    assert pub_fail.status_code == 400
    assert "must be approved" in pub_fail.json()["detail"]
    
    # 3. Approve job posting
    app_resp = await client.post(
        f"/api/v1/jobs/{job_id}/approve",
        headers=_auth(t["token"])
    )
    assert app_resp.status_code == 200
    assert app_resp.json()["status"] == "APPROVED"
    
    # 4. Publish job posting
    pub_resp = await client.post(
        f"/api/v1/jobs/{job_id}/publish",
        headers=_auth(t["token"]),
        json={"channels": ["linkedin", "indeed"]}
    )
    assert pub_resp.status_code == 200
    data = pub_resp.json()
    assert data["status"] == "PUBLISHED"
    assert "linkedin" in data["sourcing_channels"]
    assert "indeed" in data["sourcing_channels"]
    assert "referral_url" in data["sourcing_channels"]["linkedin"]


@pytest.mark.anyio
async def test_job_cross_tenant_isolation(client: AsyncClient):
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")
    
    # Setup department for Tenant A
    dept_a_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t_a["token"]),
        json={"name": "Engineering A"}
    )
    dept_a_id = dept_a_resp.json()["id"]
    
    # Create Job under Tenant A
    job_a_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t_a["token"]),
        json={
            "title": "Rust Developer A",
            "description": "Rust description A.",
            "department_id": dept_a_id,
            "requirements": ["Rust"]
        }
    )
    job_a_id = job_a_resp.json()["id"]
    
    # Tenant B tries to approve Tenant A's job - should fail (404 not found due to RLS)
    b_approve = await client.post(
        f"/api/v1/jobs/{job_a_id}/approve",
        headers=_auth(t_b["token"])
    )
    assert b_approve.status_code == 404
