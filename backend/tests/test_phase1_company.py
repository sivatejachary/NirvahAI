"""
Phase 1 Integration Tests: Company, Offices, Departments, Teams, Policies
Verifies tenant isolation for all new Phase 1 entities.
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
    """Create a tenant and return {token, tenant_id}."""
    slug = f"t1-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
    return {"token": data["access_token"], "tenant_id": data["tenant_id"]}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Setup Wizard ──────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_wizard_state_starts_at_zero(client: AsyncClient):
    t = await _setup_tenant(client)
    resp = await client.get("/api/v1/company/wizard", headers=_auth(t["token"]))
    assert resp.status_code == 200
    data = resp.json()
    assert data["completion_percentage"] == 0
    assert data["is_complete"] is False


# ── Company Profile ───────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_update_company_profile(client: AsyncClient):
    t = await _setup_tenant(client)
    resp = await client.patch("/api/v1/company/profile", headers=_auth(t["token"]), json={
        "legal_name": "Acme Technologies Ltd",
        "industry": "Technology",
        "headquarters_country": "India",
        "headquarters_city": "Hyderabad",
    })
    assert resp.status_code == 200
    # Wizard company_profile step should now be marked
    wizard = await client.get("/api/v1/company/wizard", headers=_auth(t["token"]))
    assert wizard.json()["steps"]["company_profile"] is True


# ── Offices ───────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_and_list_offices(client: AsyncClient):
    t = await _setup_tenant(client)
    create_resp = await client.post("/api/v1/company/offices", headers=_auth(t["token"]), json={
        "name": "Hyderabad HQ",
        "city": "Hyderabad",
        "country": "India",
        "address_line1": "123 Tech Park",
        "time_zone": "Asia/Kolkata",
    })
    assert create_resp.status_code == 201
    office_id = create_resp.json()["id"]

    list_resp = await client.get("/api/v1/company/offices", headers=_auth(t["token"]))
    assert list_resp.status_code == 200
    offices = list_resp.json()
    assert any(o["id"] == office_id for o in offices)


@pytest.mark.anyio
async def test_office_cross_tenant_isolation(client: AsyncClient):
    """Tenant A's office must not appear for Tenant B."""
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")

    # Tenant A creates an office
    await client.post("/api/v1/company/offices", headers=_auth(t_a["token"]), json={
        "name": "Tenant A Office", "city": "Mumbai", "country": "India",
    })

    # Tenant B should see 0 offices
    resp_b = await client.get("/api/v1/company/offices", headers=_auth(t_b["token"]))
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 0


# ── Departments ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_department_hierarchy(client: AsyncClient):
    t = await _setup_tenant(client)

    # Create parent
    parent = await client.post("/api/v1/company/departments", headers=_auth(t["token"]), json={
        "name": "Engineering",
        "description": "All engineering teams",
    })
    assert parent.status_code == 201
    parent_id = parent.json()["id"]

    # Create child
    child = await client.post("/api/v1/company/departments", headers=_auth(t["token"]), json={
        "name": "Backend Engineering",
        "parent_id": parent_id,
    })
    assert child.status_code == 201

    # List root departments
    root_depts = await client.get("/api/v1/company/departments", headers=_auth(t["token"]))
    assert len(root_depts.json()) == 1  # Only "Engineering" at root

    # List children of Engineering
    children = await client.get(
        f"/api/v1/company/departments?parent_id={parent_id}",
        headers=_auth(t["token"])
    )
    assert len(children.json()) == 1  # "Backend Engineering"


@pytest.mark.anyio
async def test_department_cross_tenant_isolation(client: AsyncClient):
    t_a = await _setup_tenant(client, "-da")
    t_b = await _setup_tenant(client, "-db")

    await client.post("/api/v1/company/departments", headers=_auth(t_a["token"]), json={
        "name": "Secret Dept"
    })

    resp_b = await client.get("/api/v1/company/departments", headers=_auth(t_b["token"]))
    assert len(resp_b.json()) == 0


# ── Teams ─────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_create_team_requires_valid_tenant_department(client: AsyncClient):
    t_a = await _setup_tenant(client, "-ta")
    t_b = await _setup_tenant(client, "-tb")

    # Create dept in Tenant A
    dept_resp = await client.post("/api/v1/company/departments", headers=_auth(t_a["token"]), json={
        "name": "Engineering"
    })
    dept_id_a = dept_resp.json()["id"]

    # Tenant B CANNOT create a team using Tenant A's department_id
    resp = await client.post("/api/v1/company/teams", headers=_auth(t_b["token"]), json={
        "department_id": dept_id_a,
        "name": "Rogue Team",
    })
    # Should fail because dept_id_a doesn't exist in Tenant B's scope
    assert resp.status_code == 404


# ── Policies ──────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_policy_lifecycle(client: AsyncClient):
    t = await _setup_tenant(client)

    # 1. Create policy
    create = await client.post("/api/v1/policies/", headers=_auth(t["token"]), json={
        "title": "Leave Policy 2026",
        "category": "leave",
        "initial_content": "# Leave Policy\n\nEmployees are entitled to 21 days annual leave.",
    })
    assert create.status_code == 201
    policy_id = create.json()["id"]

    # 2. List versions - should have 1 draft version
    versions = await client.get(f"/api/v1/policies/{policy_id}/versions", headers=_auth(t["token"]))
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    version_id = versions.json()[0]["id"]
    assert versions.json()[0]["status"] == "draft"

    # 3. Submit for review
    submit = await client.post(
        f"/api/v1/policies/{policy_id}/versions/{version_id}/submit",
        headers=_auth(t["token"])
    )
    assert submit.status_code == 200

    # 4. Approve
    approve = await client.post(
        f"/api/v1/policies/{policy_id}/versions/{version_id}/approve",
        headers=_auth(t["token"])
    )
    assert approve.status_code == 200

    # 5. Publish
    publish = await client.post(
        f"/api/v1/policies/{policy_id}/versions/{version_id}/publish",
        headers=_auth(t["token"]),
        json={},
    )
    assert publish.status_code == 200
    assert "published successfully" in publish.json()["message"].lower()


@pytest.mark.anyio
async def test_policy_cross_tenant_isolation(client: AsyncClient):
    t_a = await _setup_tenant(client, "-pa")
    t_b = await _setup_tenant(client, "-pb")

    # Create policy in Tenant A
    create_a = await client.post("/api/v1/policies/", headers=_auth(t_a["token"]), json={
        "title": "Private Leave Policy",
        "category": "leave",
    })
    policy_id_a = create_a.json()["id"]

    # Tenant B should see 0 policies
    list_b = await client.get("/api/v1/policies/", headers=_auth(t_b["token"]))
    assert len(list_b.json()) == 0

    # Tenant B should get 404 when accessing Tenant A's policy directly
    get_b = await client.get(f"/api/v1/policies/{policy_id_a}", headers=_auth(t_b["token"]))
    assert get_b.status_code == 404


@pytest.mark.anyio
async def test_cannot_publish_unapproved_policy(client: AsyncClient):
    t = await _setup_tenant(client)
    create = await client.post("/api/v1/policies/", headers=_auth(t["token"]), json={
        "title": "Draft Only Policy",
        "category": "wfh",
    })
    policy_id = create.json()["id"]
    versions = await client.get(f"/api/v1/policies/{policy_id}/versions", headers=_auth(t["token"]))
    version_id = versions.json()[0]["id"]

    # Try to publish a draft directly (skip review and approval)
    publish = await client.post(
        f"/api/v1/policies/{policy_id}/versions/{version_id}/publish",
        headers=_auth(t["token"]),
        json={},
    )
    assert publish.status_code == 400  # Must be approved first
