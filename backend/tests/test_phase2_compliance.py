"""
Phase 2 Integration Tests: Compliance, Consent, Accommodations, and DSAR Deletions
Verifies tenant isolation and functional business rules.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport

from sqlalchemy import select
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
        yield c


async def _setup_tenant(client: AsyncClient, slug_suffix: str = "") -> dict:
    """Create a tenant and return {token, tenant_id, email}."""
    slug = f"comp-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
    return {"token": data["access_token"], "tenant_id": data["tenant_id"], "email": email}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Compliance Profile ────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_and_update_compliance_profile(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # 1. Get default profile (should return default object)
    resp = await client.get("/api/v1/compliance/profile", headers=_auth(t["token"]))
    assert resp.status_code == 200
    data = resp.json()
    assert data["strict_consent_required"] is True
    assert data["jurisdictions"] == []
    
    # 2. Update compliance profile (tenant_admin)
    update_resp = await client.put(
        "/api/v1/compliance/profile",
        headers=_auth(t["token"]),
        json={
            "jurisdictions": ["GDPR", "NYC_144"],
            "ai_risk_classification": "HIGH",
            "bias_audit_requirements": {"selection_rate_tracking": True},
            "strict_consent_required": True
        }
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert "GDPR" in data["jurisdictions"]
    assert data["ai_risk_classification"] == "HIGH"


@pytest.mark.anyio
async def test_compliance_profile_cross_tenant_isolation(client: AsyncClient):
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")
    
    # Set Profile for Tenant A
    await client.put(
        "/api/v1/compliance/profile",
        headers=_auth(t_a["token"]),
        json={"jurisdictions": ["GDPR"], "strict_consent_required": True}
    )
    
    # Set Profile for Tenant B
    await client.put(
        "/api/v1/compliance/profile",
        headers=_auth(t_b["token"]),
        json={"jurisdictions": ["CCPA"], "strict_consent_required": False}
    )
    
    # Try reading Tenant A profile using Tenant B credentials
    # Since endpoints resolve tenant context strictly from the token,
    # requesting the endpoint using Tenant B's token will only return Tenant B's profile.
    resp = await client.get("/api/v1/compliance/profile", headers=_auth(t_b["token"]))
    assert resp.status_code == 200
    data = resp.json()
    assert "CCPA" in data["jurisdictions"]
    assert "GDPR" not in data["jurisdictions"]


# ── Consent Lifecycle ─────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_candidate_consent_registration(client: AsyncClient):
    t = await _setup_tenant(client)
    candidate_id = str(uuid.uuid4())
    
    # 1. Post consent
    consent_resp = await client.post(
        "/api/v1/compliance/consent",
        headers=_auth(t["token"]),
        json={
            "candidate_id": candidate_id,
            "workflow_stage": "MCQ",
            "consent_status": True
        }
    )
    assert consent_resp.status_code == 200
    
    # 2. Check consent status
    check_resp = await client.get(
        f"/api/v1/compliance/consent/{candidate_id}/MCQ",
        headers=_auth(t["token"])
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["consent_status"] is True


# ── Accommodations ────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_accommodation_request_workflow(client: AsyncClient):
    t = await _setup_tenant(client)
    candidate_id = str(uuid.uuid4())
    
    # 1. Submit accommodation request
    acc_resp = await client.post(
        "/api/v1/compliance/accommodations",
        headers=_auth(t["token"]),
        json={
            "candidate_id": candidate_id,
            "request_type": "EXTRA_TIME",
            "details": "Requesting 50% more time on coding assessment due to dyslexia."
        }
    )
    assert acc_resp.status_code == 200
    req_id = acc_resp.json()["id"]
    
    # 2. List accommodation requests
    list_resp = await client.get("/api/v1/compliance/accommodations", headers=_auth(t["token"]))
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["id"] == req_id
    
    # 3. Review accommodation request (HR manager)
    review_resp = await client.patch(
        f"/api/v1/compliance/accommodations/{req_id}/review",
        headers=_auth(t["token"]),
        json={
            "status": "APPROVED",
            "review_notes": "Granted extra time limit multiplier 1.5x in config."
        }
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "APPROVED"


# ── Privacy Requests (DSAR) ───────────────────────────────────────────────────

@pytest.mark.anyio
async def test_privacy_request_dsar_workflow(client: AsyncClient):
    t = await _setup_tenant(client)
    email = "applicant@external.com"
    
    # 1. Create DSAR deletion request
    req_resp = await client.post(
        "/api/v1/compliance/privacy-requests",
        headers=_auth(t["token"]),
        json={
            "request_type": "DELETION",
            "candidate_email": email
        }
    )
    assert req_resp.status_code == 200
    data = req_resp.json()
    request_id = data["request_id"]
    
    # Normally a token is sent to the candidate email.
    # In SQLite tests, the token is recorded in the database.
    # We can retrieve the token from the mock log or we can mock/stub it,
    # but since our service returns the model or token in debug mode,
    # let's look up the request from DB directly to verify token.
    # Actually, we can get the token from the database directly by calling a db utility, or
    # let's bypass by looking at the verification token.
    # Since we need to get the verification_token, let's write a small back-door or just query the database in the test.
    from app.core.database import AsyncSessionLocal
    from app.models.compliance import PrivacyRequest
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(PrivacyRequest).where(PrivacyRequest.id == uuid.UUID(request_id)))
        db_req = result.scalar_one()
        token = db_req.verification_token
        
    # 2. Verify token
    verify_resp = await client.post(
        f"/api/v1/compliance/privacy-requests/{request_id}/verify?token={token}",
        headers=_auth(t["token"])
    )
    assert verify_resp.status_code == 200
    
    # 3. Execute request (tenant_admin)
    exec_resp = await client.post(
        f"/api/v1/compliance/privacy-requests/{request_id}/execute",
        headers=_auth(t["token"])
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["status"] == "COMPLETED"
