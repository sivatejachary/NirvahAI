"""
API v1 Router — aggregates all routers under /api/v1
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.company import router as company_router
from app.api.v1.policies import router as policies_router
from app.api.v1.compliance import router as compliance_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.applications import router as applications_router
from app.api.v1.public import router as public_router
from app.api.v1.assessments import router as assessments_router
from app.api.v1.public_challenges import router as public_challenges_router
from app.api.v1.public_interviews import router as public_interviews_router
from app.api.v1.public_hackathons import router as public_hackathons_router
from app.api.v1.public_calls import router as public_calls_router
from app.api.v1.public_scheduler import router as public_scheduler_router
from app.api.v1.selection import router as selection_router
from app.api.v1.offers import router as offers_router
from app.api.v1.bgv import router as bgv_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.hr_chat import router as hr_chat_router
from app.api.v1.performance import router as performance_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.warning_letters import router as warning_letters_router
from app.api.v1.offboarding import router as offboarding_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.sandbox import router as sandbox_router
from app.api.v1.pipeline import router as pipeline_router
from app.api.v1.notifications import router as notifications_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(tenants_router)
router.include_router(company_router)
router.include_router(policies_router)
router.include_router(compliance_router)
router.include_router(workflows_router)
router.include_router(jobs_router)
router.include_router(applications_router)
router.include_router(public_router)
router.include_router(assessments_router)
router.include_router(public_challenges_router)
router.include_router(public_interviews_router)
router.include_router(public_hackathons_router)
router.include_router(public_calls_router)
router.include_router(public_scheduler_router)
router.include_router(selection_router)
router.include_router(offers_router)
router.include_router(bgv_router)
router.include_router(onboarding_router)
router.include_router(hr_chat_router)
router.include_router(performance_router)
router.include_router(meetings_router)
router.include_router(warning_letters_router)
router.include_router(offboarding_router)
router.include_router(analytics_router)
router.include_router(sandbox_router)
router.include_router(pipeline_router)
router.include_router(notifications_router)
