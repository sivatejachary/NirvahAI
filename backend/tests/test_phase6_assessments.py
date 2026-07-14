"""
Phase 6 Integration Tests: MCQ Adaptive Evaluations & Anti-Cheat Proctoring
Verifies unauthenticated candidate assessment paths, scoring calculations, proctor telemetry, and cross-tenant RLS isolation checks.
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
    slug = f"mcq-{uuid.uuid4().hex[:6]}{slug_suffix}"
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
async def test_proctored_mcq_assessment_flow(client: AsyncClient):
    t = await _setup_tenant(client)
    
    # 1. Setup Department & Job
    dept_resp = await client.post(
        "/api/v1/company/departments",
        headers=_auth(t["token"]),
        json={"name": "Operations", "description": "Global Ops"}
    )
    dept_id = dept_resp.json()["id"]
    
    job_resp = await client.post(
        "/api/v1/jobs",
        headers=_auth(t["token"]),
        json={
            "title": "Systems Lead",
            "description": "Maintain highly concurrent clusters.",
            "department_id": dept_id,
            "requirements": ["Linux", "Python"]
        }
    )
    job_id = job_resp.json()["id"]
    
    # 2. Pre-generate MCQ questions using recruiter session
    # Mock LLM generates questions inside JobMCQ table
    # We call public generate for this topic (or custom generate helper in service)
    # Since it's generated via service, let's call our internal helper by hitting an endpoint or using the mock
    # Wait, we can generate a question using our public generate endpoint if we have one, or just call generate_job_mcq directly
    # Wait! In our mock, LLMGateway.call_llm returns the pre-defined poll vs select question
    # Let's generate it using a service call or endpoint
    # Wait, does the recruiter have an endpoint to trigger MCQ generation?
    # No, but we can verify the service logic by testing starting attempt
    # Wait! For the test, we can generate job mcqs by calling the database directly or creating them.
    # Let's populate JobMCQ objects via the test setup.
    # In tests, we can just insert them using a test endpoint or directly.
    # Since we are using ASGI client, let's just trigger a public start and verify it returns correct states!
    # Wait! How can we insert JobMCQs in the test database?
    # We can write a quick post endpoint for test setup or add it inside test_phase6_assessments.py database session!
    # Let's use the DB connection to insert it, or call the service directly.
    # Wait! In tests, can we import the service and DB session?
    # Yes! We can import `get_db` or import the models and insert them!
    # Let's import `AsyncSessionLocal` and insert two questions!
    from app.core.database import AsyncSessionLocal
    from app.models.assessment import JobMCQ
    
    # Insert 2 mock questions
    async with AsyncSessionLocal() as session:
        # Resolve tenant UUID
        t_uuid = uuid.UUID(t["tenant_id"])
        j_uuid = uuid.UUID(job_id)
        
        q1 = JobMCQ(
            tenant_id=t_uuid,
            job_id=j_uuid,
            question_text="Which of the following describes select() vs poll()?",
            options=["select uses fd_set limit", "poll uses pollfd array", "both have same speed", "poll is slower"],
            correct_option="poll uses pollfd array",
            difficulty="MID"
        )
        q2 = JobMCQ(
            tenant_id=t_uuid,
            job_id=j_uuid,
            question_text="What is Postgres RLS?",
            options=["Encryption", "Row-level row filters", "Column limits", "Speed indexes"],
            correct_option="Row-level row filters",
            difficulty="MID"
        )
        session.add_all([q1, q2])
        await session.commit()

    # 3. Register Consent & Submit Candidate Application
    cand_email = "test.candidate@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)
    
    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "MCQ", "consent_status": True}
    )
    
    app_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t["slug"]},
        json={
            "job_id": job_id,
            "candidate_name": "Test Candidate",
            "candidate_email": cand_email,
            "resume_text": "Systems engineer."
        }
    )
    assert app_resp.status_code == 201
    app_id = app_resp.json()["id"]

    # 4. Start assessment attempt
    start_resp = await client.post(
        "/api/v1/public/assessments/attempts",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"application_id": app_id, "type": "MCQ"}
    )
    assert start_resp.status_code == 201
    attempt_id = start_resp.json()["attempt_id"]
    assert start_resp.json()["status"] == "STARTED"

    # 5. Fetch next questions and answer them
    # Question 1
    next1 = await client.get(
        f"/api/v1/public/assessments/attempts/{attempt_id}/next",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert next1.status_code == 200
    q1_data = next1.json()["question"]
    assert q1_data["question_text"] is not None

    sub1 = await client.post(
        f"/api/v1/public/assessments/attempts/{attempt_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"question_id": q1_data["id"], "candidate_answer": "poll uses pollfd array"}
    )
    assert sub1.status_code == 200
    assert sub1.json()["status"] == "STARTED" # not fully complete yet

    # Question 2
    next2 = await client.get(
        f"/api/v1/public/assessments/attempts/{attempt_id}/next",
        headers={"X-Tenant-Slug": t["slug"]}
    )
    assert next2.status_code == 200
    q2_data = next2.json()["question"]
    
    sub2 = await client.post(
        f"/api/v1/public/assessments/attempts/{attempt_id}/submit",
        headers={"X-Tenant-Slug": t["slug"]},
        json={"question_id": q2_data["id"], "candidate_answer": "Row-level row filters"}
    )
    assert sub2.status_code == 200
    assert sub2.json()["status"] == "COMPLETED"
    assert sub2.json()["score"] == 100.0

    # 6. Verify application promoted to TECH INTERVIEW
    app_details = await client.get(
        f"/api/v1/applications/{app_id}",
        headers=_auth(t["token"])
    )
    assert app_details.status_code == 200
    assert app_details.json()["status"] == "TECHNICAL_INTERVIEW_STAGE"


@pytest.mark.anyio
async def test_proctor_telemetry_integrity_scaling_and_rls(client: AsyncClient):
    t_a = await _setup_tenant(client, "-a")
    t_b = await _setup_tenant(client, "-b")

    # Setup job and application under Tenant A
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
            "title": "Go Dev",
            "description": "Write Go code.",
            "department_id": dept_a_id,
            "requirements": ["Go"]
        }
    )
    job_a_id = job_a_resp.json()["id"]

    cand_email = "applicant.proctor@example.com"
    cand_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, cand_email)
    
    await client.post(
        "/api/v1/public/consent",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"candidate_id": str(cand_uuid), "workflow_stage": "MCQ", "consent_status": True}
    )

    app_a_resp = await client.post(
        "/api/v1/public/applications",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"job_id": job_a_id, "candidate_name": "Proctored Candidate", "candidate_email": cand_email, "resume_text": "Golang Dev."}
    )
    app_a_id = app_a_resp.json()["id"]

    # Start attempt
    start_resp = await client.post(
        "/api/v1/public/assessments/attempts",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"application_id": app_a_id}
    )
    attempt_id = start_resp.json()["attempt_id"]

    # Post proctor blurs to scale integrity risk
    # Blur 1
    p1 = await client.post(
        f"/api/v1/public/assessments/attempts/{attempt_id}/proctor",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"event_type": "TAB_FOCUS_LOST", "metadata": {"lost_duration": "4s"}}
    )
    assert p1.status_code == 200

    # Blur 2
    await client.post(
        f"/api/v1/public/assessments/attempts/{attempt_id}/proctor",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"event_type": "TAB_FOCUS_LOST"}
    )
    # Blur 3 -> triggers MEDIUM integrity risk
    await client.post(
        f"/api/v1/public/assessments/attempts/{attempt_id}/proctor",
        headers={"X-Tenant-Slug": t_a["slug"]},
        json={"event_type": "TAB_FOCUS_LOST"}
    )

    # Recruiter reads attempt details
    details = await client.get(
        f"/api/v1/assessments/attempts/{attempt_id}",
        headers=_auth(t_a["token"])
    )
    assert details.status_code == 200
    assert details.json()["integrity_risk"] == "MEDIUM"
    assert len(details.json()["proctoring_logs"]) == 3

    # Cross-Tenant RLS isolation: Tenant B tries to inspect Tenant A's attempt details - should fail with 404
    b_get = await client.get(
        f"/api/v1/assessments/attempts/{attempt_id}",
        headers=_auth(t_b["token"])
    )
    assert b_get.status_code == 404
