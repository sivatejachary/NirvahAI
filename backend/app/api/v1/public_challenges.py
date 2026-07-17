"""
Public Challenges & Coding Sandbox Router — Phase 7
Allows candidates to fetch coding challenges and submit compilation/execution runs.
Resolved via X-Tenant-Slug header.
"""
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, TenantId
from app.models.challenge import CodingChallenge, CodingSubmission
from app.models.assessment import AssessmentAttempt
from app.models.application import Application
from app.services.sandbox import SandboxService

router = APIRouter(prefix="/public/challenges", tags=["Public Candidate Coding Sandbox"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CodeRunRequest(BaseModel):
    challenge_id: str
    code: str
    language: str
    run_draft_only: Optional[bool] = False # True for testing console output, False for score submissions


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{attempt_id}")
async def public_get_attempt_challenges(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str
):
    """
    Returns coding challenges configured for the candidate's assessment attempt.
    """
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id

    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

    # Load attempt details
    att_stmt = select(AssessmentAttempt).where(
        AssessmentAttempt.tenant_id == t_uuid,
        AssessmentAttempt.id == att_uuid
    )
    attempt = (await db.execute(att_stmt)).scalar_one_or_none()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment attempt not found."
        )

    # Resolve application and job configuration
    app_stmt = select(Application).where(Application.id == attempt.application_id)
    app = (await db.execute(app_stmt)).scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application reference missing."
        )

    # Query all active coding challenges for this job
    chall_stmt = select(CodingChallenge).where(
        CodingChallenge.tenant_id == t_uuid,
        CodingChallenge.job_id == app.job_id
    )
    challenges = (await db.execute(chall_stmt)).scalars().all()

    if not challenges:
        c1 = CodingChallenge(
            tenant_id=t_uuid,
            job_id=app.job_id,
            title="Algorithm: Two Sum Target",
            description="Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nInput format:\n- Line 1: comma-separated integers (e.g. `2,7,11,15`)\n- Line 2: target integer (e.g. `9`)",
            starter_code={
                "python": "import sys\n\ndef solution(nums, target):\n    # Write your solution here\n    # Example return: [0, 1]\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []\n\nif __name__ == \"__main__\":\n    lines = sys.stdin.read().splitlines()\n    if len(lines) >= 2:\n        nums = [int(x) for x in lines[0].split(',')]\n        target = int(lines[1])\n        print(solution(nums, target))",
                "javascript": "const fs = require('fs');\n\nfunction solution(nums, target) {\n    // Write your solution here\n    // Example return: [0, 1]\n    for (let i = 0; i < nums.length; i++) {\n        for (let j = i + 1; j < nums.length; j++) {\n            if (nums[i] + nums[j] === target) {\n                return [i, j];\n            }\n        }\n    }\n    return [];\n}\n\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 2) {\n    const nums = input[0].split(',').map(Number);\n    const target = Number(input[1]);\n    console.log(JSON.stringify(solution(nums, target)));\n}"
            },
            test_cases=[
                {"input": "2,7,11,15\n9", "output": "[0, 1]", "hidden": false},
                {"input": "3,2,4\n6", "output": "[1, 2]", "hidden": false},
                {"input": "3,3\n6", "output": "[0, 1]", "hidden": true}
            ]
        )
        db.add(c1)
        await db.flush()
        challenges = [c1]


    return [
        {
            "id": str(c.id),
            "title": c.title,
            "description": c.description,
            "starter_code": c.starter_code,
            # Redact expected output solutions for candidate security
            "test_cases": [
                {"input": tc.get("input"), "hidden": tc.get("hidden", False)}
                for tc in c.test_cases
            ]
        }
        for c in challenges
    ]


@router.post("/{attempt_id}/submit")
async def public_submit_code_solution(
    db: DBSession,
    tenant_id: TenantId,
    attempt_id: str,
    body: CodeRunRequest
):
    """
    Executes and scores candidate submissions against registered test cases in a secure sandbox.
    """
    t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    att_uuid = uuid.UUID(attempt_id) if isinstance(attempt_id, str) else attempt_id
    chall_uuid = uuid.UUID(body.challenge_id) if isinstance(body.challenge_id, str) else body.challenge_id

    from sqlalchemy import text
    if "sqlite" not in str(db.bind.url):
        await db.execute(text("SET LOCAL app.bypass_rls = 'true'"))

    # Verify attempt
    att_stmt = select(AssessmentAttempt).where(
        AssessmentAttempt.tenant_id == t_uuid,
        AssessmentAttempt.id == att_uuid
    )
    attempt = (await db.execute(att_stmt)).scalar_one_or_none()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment attempt not found."
        )

    # Verify challenge
    c_stmt = select(CodingChallenge).where(
        CodingChallenge.tenant_id == t_uuid,
        CodingChallenge.id == chall_uuid
    )
    challenge = (await db.execute(c_stmt)).scalar_one_or_none()
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coding challenge not found."
        )

    # 1. Compile and Execute code
    # If run_draft_only is True, compile only against the first test case and return console output
    test_cases_to_run = challenge.test_cases
    if body.run_draft_only:
        test_cases_to_run = challenge.test_cases[:1] if len(challenge.test_cases) > 0 else []

    results = []
    total_passed = 0

    for idx, tc in enumerate(test_cases_to_run):
        inp = tc.get("input", "")
        expected = tc.get("output", "").strip()

        exec_res = SandboxService.execute_code(
            code=body.code,
            language=body.language,
            input_data=inp
        )

        got = exec_res["output"].strip()
        passed = (exec_res["status"] == "ACCEPTED") and (got == expected)
        if passed:
            total_passed += 1

        results.append({
            "test_case_index": idx,
            "passed": passed,
            "status": exec_res["status"],
            "expected": expected if not tc.get("hidden") else "[HIDDEN]",
            "got": got if not tc.get("hidden") else "[HIDDEN]",
            "error": exec_res["error"],
            "duration": exec_res["duration"]
        })

    # Deduce overall status
    overall_status = "ACCEPTED"
    for r in results:
        if not r["passed"]:
            overall_status = r["status"] if r["status"] != "ACCEPTED" else "WRONG_ANSWER"
            break

    # 2. Record submission details in history if not draft run
    if not body.run_draft_only:
        sub = CodingSubmission(
            tenant_id=t_uuid,
            assessment_attempt_id=att_uuid,
            challenge_id=chall_uuid,
            code=body.code,
            language=body.language,
            status=overall_status,
            results=results
        )
        db.add(sub)
        
        # Calculate score percentage & update application stage
        score_percent = (total_passed / len(challenge.test_cases)) * 100 if len(challenge.test_cases) > 0 else 0.0
        attempt.score = score_percent
        attempt.status = "COMPLETED"

        app_stmt = select(Application).where(Application.id == attempt.application_id)
        app = (await db.execute(app_stmt)).scalar_one_or_none()
        if app:
            if score_percent >= 60.0:
                app.status = "TECHNICAL_INTERVIEW_STAGE" # Advanced to next interview
            else:
                app.status = "REJECTED"

        await db.flush()

    return {
        "status": overall_status,
        "total_test_cases": len(test_cases_to_run),
        "passed_count": total_passed,
        "results": results
    }


# Helper injection import to prevent circular dependency
from sqlalchemy import select
