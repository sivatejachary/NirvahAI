"""
Policy API Router — Phase 1
Full lifecycle: create, draft, review, approve, publish, version history.
IMPORTANT: AI drafts are clearly marked. Human approval is always required before publishing.
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import DBSession, TenantId, CurrentUserId, require_role
from app.services import policy as policy_svc
from app.services.audit import AuditService

router = APIRouter(prefix="/policies", tags=["Policies"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PolicyCreate(BaseModel):
    title: str
    category: str
    description: Optional[str] = None
    initial_content: Optional[str] = None
    is_ai_drafted: bool = False
    requires_legal_review: bool = False
    applies_to: Optional[list[str]] = None


class PolicyVersionCreate(BaseModel):
    content: str
    change_summary: Optional[str] = None
    is_ai_drafted: bool = False


class PublishRequest(BaseModel):
    effective_from: Optional[datetime] = None


class RejectRequest(BaseModel):
    rejection_reason: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", summary="List all policy documents")
async def list_policies(
    tenant_id: TenantId,
    db: DBSession,
    category: Optional[str] = None,
):
    policies = await policy_svc.list_policies(db, tenant_id, category)
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "slug": p.slug,
            "category": p.category,
            "description": p.description,
            "status": p.status,
            "requires_legal_review": p.requires_legal_review,
            "applies_to": p.applies_to,
            "has_published_version": p.current_published_version_id is not None,
            "created_at": p.created_at.isoformat(),
        }
        for p in policies
    ]


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new policy document",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def create_policy(
    body: PolicyCreate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    if body.category not in policy_svc.POLICY_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid category. Valid: {policy_svc.POLICY_CATEGORIES}",
        )

    policy = await policy_svc.create_policy(
        db=db,
        tenant_id=tenant_id,
        title=body.title,
        category=body.category,
        description=body.description,
        authored_by_id=user_id,
        initial_content=body.initial_content or "",
        is_ai_drafted=body.is_ai_drafted,
        requires_legal_review=body.requires_legal_review,
        applies_to=body.applies_to,
    )

    audit = AuditService(db)
    await audit.log(
        action="policy.created",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="policy_document",
        entity_id=str(policy.id),
        reason_code="POLICY_CREATED",
        output_summary={
            "title": body.title,
            "category": body.category,
            "is_ai_drafted": body.is_ai_drafted,
        },
    )

    return {
        "id": str(policy.id),
        "title": policy.title,
        "slug": policy.slug,
        "status": policy.status,
    }


@router.get("/{policy_id}", summary="Get a policy document")
async def get_policy(policy_id: str, tenant_id: TenantId, db: DBSession):
    policy = await policy_svc.get_policy(db, tenant_id, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")
    return {
        "id": str(policy.id),
        "title": policy.title,
        "slug": policy.slug,
        "category": policy.category,
        "description": policy.description,
        "status": policy.status,
        "applies_to": policy.applies_to,
        "requires_legal_review": policy.requires_legal_review,
        "published_version_id": (
            str(policy.current_published_version_id)
            if policy.current_published_version_id else None
        ),
    }


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/{policy_id}/versions", summary="Get all versions of a policy")
async def list_policy_versions(
    policy_id: str, tenant_id: TenantId, db: DBSession
):
    policy = await policy_svc.get_policy(db, tenant_id, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")

    versions = await policy_svc.list_policy_versions(db, tenant_id, policy_id)
    return [
        {
            "id": str(v.id),
            "version_number": v.version_number,
            "status": v.status,
            "is_ai_drafted": v.is_ai_drafted,
            "change_summary": v.change_summary,
            "authored_by_id": str(v.authored_by_id) if v.authored_by_id else None,
            "approved_by_id": str(v.approved_by_id) if v.approved_by_id else None,
            "published_at": v.published_at.isoformat() if v.published_at else None,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@router.post(
    "/{policy_id}/versions",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft version",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def create_policy_version(
    policy_id: str,
    body: PolicyVersionCreate,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    policy = await policy_svc.get_policy(db, tenant_id, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")

    version = await policy_svc.create_policy_version(
        db, tenant_id, policy_id, body.content,
        user_id, body.change_summary, body.is_ai_drafted,
    )
    audit = AuditService(db)
    await audit.log(
        action="policy.version_created",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="policy_version",
        entity_id=str(version.id),
        reason_code="POLICY_VERSION_CREATED",
        output_summary={"version_number": version.version_number, "is_ai_drafted": body.is_ai_drafted},
    )
    return {"id": str(version.id), "version_number": version.version_number}


@router.post(
    "/{policy_id}/versions/{version_id}/submit",
    summary="Submit version for review",
    dependencies=[Depends(require_role("tenant_admin", "hr_manager"))],
)
async def submit_for_review(
    policy_id: str,
    version_id: str,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    version = await policy_svc.submit_policy_for_review(db, tenant_id, version_id, user_id)
    if not version:
        raise HTTPException(status_code=400, detail="Cannot submit: version must be in draft status.")

    audit = AuditService(db)
    await audit.log(
        action="policy.submitted_for_review",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="policy_version",
        entity_id=version_id,
        reason_code="POLICY_REVIEW_SUBMISSION",
    )
    return {"message": "Version submitted for review.", "version_id": version_id}


@router.post(
    "/{policy_id}/versions/{version_id}/approve",
    summary="Approve a policy version",
    dependencies=[Depends(require_role("tenant_admin"))],
)
async def approve_policy_version(
    policy_id: str,
    version_id: str,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    version = await policy_svc.approve_policy_version(db, tenant_id, version_id, user_id)
    if not version:
        raise HTTPException(status_code=400, detail="Cannot approve: version must be under review.")

    audit = AuditService(db)
    await audit.log(
        action="policy.approved",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="policy_version",
        entity_id=version_id,
        reason_code="POLICY_APPROVED",
    )
    return {"message": "Policy version approved.", "version_id": version_id}


@router.post(
    "/{policy_id}/versions/{version_id}/publish",
    summary="Publish an approved policy version",
    dependencies=[Depends(require_role("tenant_admin"))],
)
async def publish_policy_version(
    policy_id: str,
    version_id: str,
    body: PublishRequest,
    tenant_id: TenantId,
    user_id: CurrentUserId,
    db: DBSession,
):
    """
    Publishes a policy version. This makes it the AUTHORITATIVE version
    that the HR support agent will use to answer employee questions.
    Only APPROVED versions can be published.
    """
    version = await policy_svc.publish_policy_version(
        db, tenant_id, policy_id, version_id, user_id, body.effective_from
    )
    if not version:
        raise HTTPException(
            status_code=400,
            detail="Cannot publish: version must be approved first.",
        )

    audit = AuditService(db)
    await audit.log(
        action="policy.published",
        actor_type="user",
        actor_id=user_id,
        tenant_id=tenant_id,
        entity_type="policy_version",
        entity_id=version_id,
        reason_code="POLICY_PUBLISHED",
        output_summary={
            "version_number": version.version_number,
            "effective_from": version.effective_from.isoformat() if version.effective_from else None,
        },
    )
    return {
        "message": "Policy published successfully. This is now the authoritative version.",
        "version_number": version.version_number,
        "effective_from": version.effective_from.isoformat() if version.effective_from else None,
    }


@router.get("/slug/{slug}/content", summary="Get published policy content by slug (HR agent use)")
async def get_policy_content_by_slug(slug: str, tenant_id: TenantId, db: DBSession):
    """Returns only the published content. Used by the HR support agent."""
    content = await policy_svc.get_published_policy_content(db, tenant_id, slug)
    if content is None:
        raise HTTPException(
            status_code=404, detail="No published policy found for this slug."
        )
    return {"slug": slug, "content": content}
