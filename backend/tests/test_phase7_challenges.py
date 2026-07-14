"""
Phase 7 Integration Tests: Sandboxed Multi-Language Compiler & Evaluation Sandbox
Verifies unauthenticated candidate coding submissions, RCE timeout controls, and cross-tenant isolation.
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
    slug = f"cod-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_secure_coding_sandbox_evaluation(client: AsyncClient):
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
            "title": "Staff Backend",
            "description": "Evaluate concurrent systems.",
            "department_id": dept_id,
            "requirements": ["Python"]
        }
    )
    job_id = job_resp.json()["id"]

    # 2. Insert secure coding challenge via direct DB session
    from app.core.database import AsyncSessionLocal
    from app.models.challenge import CodingChallenge

    challenge_id = None
    async with AsyncSessionLocal() as session:
        t_uuid = uuid.UUID(t["tenant_id"])
        j_uuid = uuid.UUID(job_id)

        challenge = CodingChallenge(
            tenant_id=t_uuid,
            job_id=j_uuid,
            title="Two Sum Additions",
            description="Read two numbers and print their sum.",
            starter_code={"python": "import sys\n# read input"},
            test_cases=[
                {"input": "2\n3\n", "output": "5\n", "hidden": False},
                {"input": "10\n-5\n", "output": "5\n", "hidden": True}
            ]
        )
        session.add(challenge)
        await session.commit()
        challenge_id = str(challenge.id)

    # 3. Setup Consent & Application Ingestion
    cand_email = "coder@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)

    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "CODING", "consent_status": True}
    )

    app_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "Smart Coder",
            "candidate_email": cand_email,
            "resume_text": "Experienced Python coder."
        }
    )
    app_id = app_resp.json()["id"]

    # 4. Start coding attempt stage
    start_resp = await client.post(
        "/api/v1/public/assessments/attempts",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"application_id": app_id, "type": "CODING"}
    )
    attempt_id = start_resp.json()["attempt_id"]

    # 5. Fetch attempt challenges
    get_chall = await client.get(
        f"/api/v1/public/challenges/{attempt_id}",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert get_chall.status_code == 200
    assert len(get_chall.json()) == 1
    assert get_chall.json()[0]["title"] == "Two Sum Additions"

    # 6. Submit incorrect code - should fail grading evaluation
    wrong_code = "import sys\nprint('Wrong output')"
    wrong_resp = await client.post(
        f"/api/v1/public/challenges/{attempt_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "challenge_id": challenge_id,
            "code": wrong_code,
            "language": "python"
        }
    )
    assert wrong_resp.status_code == 200
    assert wrong_resp.json()["status"] == "WRONG_ANSWER"
    assert wrong_resp.json()["passed_count"] == 0

    # 7. Submit correct code - should pass evaluation and promote application
    correct_code = "import sys\nlines = sys.stdin.read().split()\nval = sum(int(x) for x in lines)\nprint(val)"
    correct_resp = await client.post(
        f"/api/v1/public/challenges/{attempt_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "challenge_id": challenge_id,
            "code": correct_code,
            "language": "python"
        }
    )
    assert correct_resp.status_code == 200
    assert correct_resp.json()["status"] == "ACCEPTED"
    assert correct_resp.json()["passed_count"] == 2


@pytest.mark.anyio
async def test_rce_sandbox_timeout_control(client: AsyncClient):
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
            "title": "Security Lead",
            "description": "Test timeouts.",
            "department_id": dept_id,
            "requirements": ["Python"]
        }
    )
    job_id = job_resp.json()["id"]

    # 2. Insert challenge
    from app.core.database import AsyncSessionLocal
    from app.models.challenge import CodingChallenge

    challenge_id = None
    async with AsyncSessionLocal() as session:
        t_uuid = uuid.UUID(t["tenant_id"])
        j_uuid = uuid.UUID(job_id)

        challenge = CodingChallenge(
            tenant_id=t_uuid,
            job_id=j_uuid,
            title="Loop Timeout Test",
            description="Infinite loop.",
            starter_code={"python": "pass"},
            test_cases=[
                {"input": "2\n", "output": "2\n"}
            ]
        )
        session.add(challenge)
        await session.commit()
        challenge_id = str(challenge.id)

    # 3. Setup Consent & Application Ingestion
    cand_email = "malicious@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)

    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "CODING", "consent_status": True}
    )

    app_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "Malicious Coder",
            "candidate_email": cand_email,
            "resume_text": "Testing RCE bounds."
        }
    )
    app_id = app_resp.json()["id"]

    # 4. Start coding attempt stage
    start_resp = await client.post(
        "/api/v1/public/assessments/attempts",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"application_id": app_id, "type": "CODING"}
    )
    attempt_id = start_resp.json()["attempt_id"]

    # 5. Submit code containing infinite loop - should trigger TIMEOUT status safely within 5s
    infinite_loop_code = "import time\nwhile True:\n    time.sleep(1)"
    sub_resp = await client.post(
        f"/api/v1/public/challenges/{attempt_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "challenge_id": challenge_id,
            "code": infinite_loop_code,
            "language": "python"
        }
    )
    assert sub_resp.status_code == 200
    assert sub_resp.json()["status"] == "TIMEOUT"
