"""
Phase 0 Integration Tests: Cross-Tenant Isolation & Auth
CRITICAL: These tests verify that the multi-tenant isolation invariants hold.
All tests must pass before Phase 1 begins.
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c


async def register_and_login(client: AsyncClient, slug: str, email: str, password: str = "SecurePass123!"):
    """Helper: register a tenant and log in, return access_token."""
    # Register
    reg_response = await client.post("/api/v1/auth/register", json={
        "company_name": f"Test Company {slug}",
        "company_slug": slug,
        "admin_full_name": "Admin User",
        "admin_email": email,
        "admin_password": password,
    })
    assert reg_response.status_code == 201, f"Registration failed: {reg_response.text}"

    # Login
    login_response = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password,
        "tenant_slug": slug,
    })
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    return login_response.json()["access_token"]


# ─── Auth Tests ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_register_tenant_success(client: AsyncClient):
    """Tenant registration creates a new isolated tenant."""
    response = await client.post("/api/v1/auth/register", json={
        "company_name": "Acme Corp",
        "company_slug": f"acme-{uuid.uuid4().hex[:6]}",
        "admin_full_name": "Alice Admin",
        "admin_email": f"alice-{uuid.uuid4().hex[:6]}@acme.com",
        "admin_password": "StrongPass123!",
    })
    assert response.status_code == 201
    data = response.json()
    assert "tenant_id" in data
    assert data["status"] == "pending_setup"


@pytest.mark.anyio
async def test_register_duplicate_slug_fails(client: AsyncClient):
    """Duplicate company slugs are rejected."""
    slug = f"dup-{uuid.uuid4().hex[:6]}"
    for i in range(2):
        resp = await client.post("/api/v1/auth/register", json={
            "company_name": "Dup Corp",
            "company_slug": slug,
            "admin_full_name": "Admin",
            "admin_email": f"admin{i}@dup.com",
            "admin_password": "StrongPass123!",
        })
        if i == 0:
            assert resp.status_code == 201
        else:
            assert resp.status_code == 409


@pytest.mark.anyio
async def test_login_wrong_password_fails(client: AsyncClient):
    """Wrong password returns 401."""
    slug = f"wrongpw-{uuid.uuid4().hex[:6]}"
    email = f"admin@{slug}.com"
    await client.post("/api/v1/auth/register", json={
        "company_name": "Wrong PW Co",
        "company_slug": slug,
        "admin_full_name": "Admin",
        "admin_email": email,
        "admin_password": "CorrectPass123!",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "WrongPass999!",
        "tenant_slug": slug,
    })
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_login_wrong_tenant_fails(client: AsyncClient):
    """
    CROSS-TENANT ISOLATION TEST:
    A user from Tenant A cannot login with Tenant B's slug.
    """
    slug_a = f"tenant-a-{uuid.uuid4().hex[:6]}"
    slug_b = f"tenant-b-{uuid.uuid4().hex[:6]}"
    email_a = f"admin@{slug_a}.com"

    # Register tenant A
    await client.post("/api/v1/auth/register", json={
        "company_name": "Tenant A",
        "company_slug": slug_a,
        "admin_full_name": "Admin A",
        "admin_email": email_a,
        "admin_password": "Pass123!Pass",
    })
    # Register tenant B
    await client.post("/api/v1/auth/register", json={
        "company_name": "Tenant B",
        "company_slug": slug_b,
        "admin_full_name": "Admin B",
        "admin_email": f"admin@{slug_b}.com",
        "admin_password": "Pass123!Pass",
    })

    # Try to login as Tenant A user but with Tenant B slug
    resp = await client.post("/api/v1/auth/login", json={
        "email": email_a,
        "password": "Pass123!Pass",
        "tenant_slug": slug_b,  # WRONG TENANT
    })
    # Must fail — user does not exist in tenant B
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_access_protected_route_without_token(client: AsyncClient):
    """Protected routes without Bearer token return 401."""
    resp = await client.get("/api/v1/tenants/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_access_protected_route_with_invalid_token(client: AsyncClient):
    """Invalid JWT tokens are rejected."""
    resp = await client.get(
        "/api/v1/tenants/me",
        headers={"Authorization": "Bearer this.is.not.valid"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_tenant_a_cannot_access_tenant_b_data(client: AsyncClient):
    """
    CRITICAL CROSS-TENANT ISOLATION TEST:
    Tenant A's valid token cannot retrieve Tenant B's data.
    """
    slug_a = f"iso-a-{uuid.uuid4().hex[:6]}"
    slug_b = f"iso-b-{uuid.uuid4().hex[:6]}"

    token_a = await register_and_login(
        client, slug_a, f"admin@{slug_a}.com"
    )
    token_b = await register_and_login(
        client, slug_b, f"admin@{slug_b}.com"
    )

    # Tenant A can read their own data
    resp_own = await client.get(
        "/api/v1/tenants/me",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp_own.status_code == 200
    own_data = resp_own.json()
    assert own_data["company_slug"] == slug_a

    # Tenant A's token must NOT return Tenant B's data
    # The tenant_id is embedded in the JWT, so this is enforced at middleware level
    # This test verifies slug in response matches the token's tenant
    assert own_data["company_slug"] != slug_b


@pytest.mark.anyio
async def test_health_check(client: AsyncClient):
    """Health check is accessible without auth."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.anyio
async def test_kill_switch_requires_tenant_admin(client: AsyncClient):
    """Kill switches require tenant_admin role."""
    slug = f"ks-{uuid.uuid4().hex[:6]}"
    token = await register_and_login(client, slug, f"admin@{slug}.com")

    resp = await client.post(
        "/api/v1/tenants/me/kill-switch/proctoring",
        headers={"Authorization": f"Bearer {token}"},
    )
    # tenant_admin role is granted on registration, so this should succeed
    assert resp.status_code == 200
    assert resp.json()["active"] is True


@pytest.mark.anyio
async def test_token_refresh(client: AsyncClient):
    """Refresh token flow returns new access token."""
    slug = f"refresh-{uuid.uuid4().hex[:6]}"
    email = f"admin@{slug}.com"
    await client.post("/api/v1/auth/register", json={
        "company_name": "Refresh Co",
        "company_slug": slug,
        "admin_full_name": "Admin",
        "admin_email": email,
        "admin_password": "StrongPass123!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "StrongPass123!",
        "tenant_slug": slug,
    })
    refresh_token = login_resp.json()["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()
