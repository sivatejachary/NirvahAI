"""
Phase 3 Integration Tests: Model Gateway, Prompt Registry, Cost Governor & Workflows
Verifies token accounting, budget limits, RLS, and pipeline states.
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
    slug = f"wf-{uuid.uuid4().hex[:6]}{slug_suffix}"
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


# ── Prompt Registry & Model Gateway ───────────────────────────────────────────

@pytest.mark.anyio
async def test_prompt_rendering_and_llm_execution(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # 1. Execute general simulation (runs parse mockup)
    resp = await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Experienced Python & Machine Learning Engineer."},
            "purpose": "resume_parsing"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "Sarah Connor" in data["completion"]


@pytest.mark.anyio
async def test_cost_governor_budget_limits(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # Set tight daily budget to $0.00001 (to enforce immediate budget block)
    await client.patch(
        "/api/v1/company/hiring-rules",
        headers=_auth(t["token"]),
        json={"daily_ai_budget_usd": 0.00001}
    )
    
    # First call - should succeed and log cost (cost of prompt + output will exceed $0.00001)
    first_resp = await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Short text for resume parse simulation."},
            "purpose": "resume_parsing"
        }
    )
    assert first_resp.status_code == 200
    
    # Second call - should fail with HTTP 402 Payment Required due to exceeded daily budget
    second_resp = await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Another test call that should be blocked."},
            "purpose": "resume_parsing"
        }
    )
    assert second_resp.status_code == 402
    assert "budget" in second_resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_cost_governor_cross_tenant_isolation(client: AsyncClient):
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")
    
    # Set tight budget on Tenant A only
    await client.patch(
        "/api/v1/company/hiring-rules",
        headers=_auth(t_a["token"]),
        json={"daily_ai_budget_usd": 0.00001}
    )
    
    # Exhaust Tenant A's budget
    await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t_a["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Exhausting daily limit."},
            "purpose": "resume_parsing"
        }
    )
    
    # Tenant A is blocked
    a_resp = await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t_a["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Blocked call."},
            "purpose": "resume_parsing"
        }
    )
    assert a_resp.status_code == 402
    
    # Tenant B remains completely unblocked
    b_resp = await client.post(
        "/api/v1/workflows/simulate-llm",
        headers=_auth(t_b["token"]),
        json={
            "prompt_name": "resume_parse",
            "variables": {"resume_text": "Should pass cleanly."},
            "purpose": "resume_parsing"
        }
    )
    assert b_resp.status_code == 200


# ── Workflow Lifecycles ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_workflow_lifecycle_transitions(client: AsyncClient):
    t = await _setup_tenant(client)
    app_id = str(uuid.uuid4())
    
    # 1. Start recruitment workflow
    start_resp = await client.post(
        "/api/v1/workflows",
        headers=_auth(t["token"]),
        json={"application_id": app_id}
    )
    assert start_resp.status_code == 201
    data = start_resp.json()
    instance_id = data["id"]
    assert data["current_stage"] == "MCQ"
    assert data["status"] == "RUNNING"
    
    # 2. Transition workflow to CODING
    trans_resp = await client.post(
        f"/api/v1/workflows/{instance_id}/transition",
        headers=_auth(t["token"]),
        json={
            "next_stage": "CODING",
            "state_updates": {"mcq_score": 85.0}
        }
    )
    assert trans_resp.status_code == 200
    data = trans_resp.json()
    assert data["current_stage"] == "CODING"
    assert data["state_data"]["mcq_score"] == 85.0
    assert len(data["state_data"]["history"]) == 2
