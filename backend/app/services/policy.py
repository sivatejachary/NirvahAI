"""
Policy Service — Phase 1
Manages the full policy lifecycle: draft → review → approve → publish.
AI may draft. Humans must approve. Only published versions are authoritative.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify

from app.models.company import PolicyDocument, PolicyVersion
from app.core.logging import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


POLICY_CATEGORIES = [
    "leave", "attendance", "wfh", "code_of_conduct", "notice_period",
    "benefits", "compensation", "hiring", "assessment", "interview",
    "offer", "onboarding", "offboarding", "data_privacy",
    "acceptable_use", "dress_code", "expense",
]


async def list_policies(
    db: AsyncSession, tenant_id: str, category: Optional[str] = None
) -> list[PolicyDocument]:
    q = select(PolicyDocument).where(
        PolicyDocument.tenant_id == uuid.UUID(tenant_id)
    )
    if category:
        q = q.where(PolicyDocument.category == category)
    result = await db.execute(q.order_by(PolicyDocument.title))
    return list(result.scalars().all())


async def get_policy(
    db: AsyncSession, tenant_id: str, policy_id: str
) -> Optional[PolicyDocument]:
    result = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.id == uuid.UUID(policy_id),
            PolicyDocument.tenant_id == uuid.UUID(tenant_id),
        )
    )
    return result.scalar_one_or_none()


async def get_policy_by_slug(
    db: AsyncSession, tenant_id: str, slug: str
) -> Optional[PolicyDocument]:
    result = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.slug == slug,
            PolicyDocument.tenant_id == uuid.UUID(tenant_id),
        )
    )
    return result.scalar_one_or_none()


async def create_policy(
    db: AsyncSession,
    tenant_id: str,
    title: str,
    category: str,
    description: Optional[str],
    authored_by_id: str,
    initial_content: str = "",
    is_ai_drafted: bool = False,
    requires_legal_review: bool = False,
    applies_to: Optional[list] = None,
) -> PolicyDocument:
    """
    Creates a policy document AND the first draft version (v1.0.0).
    Never publishes automatically — requires human approval.
    """
    slug = slugify(title)

    policy = PolicyDocument(
        tenant_id=uuid.UUID(tenant_id),
        title=title,
        slug=slug,
        category=category,
        description=description,
        requires_legal_review=requires_legal_review,
        applies_to=applies_to or [],
        status="draft",
        policy_owner_id=uuid.UUID(authored_by_id),
    )
    db.add(policy)
    await db.flush()

    # Create initial draft version
    version = PolicyVersion(
        tenant_id=uuid.UUID(tenant_id),
        policy_id=policy.id,
        version_number="1.0.0",
        content=initial_content or f"# {title}\n\n_Draft policy. Awaiting content._",
        content_format="markdown",
        status="draft",
        authored_by_id=uuid.UUID(authored_by_id),
        is_ai_drafted=is_ai_drafted,
    )
    db.add(version)
    await db.flush()

    return policy


async def list_policy_versions(
    db: AsyncSession, tenant_id: str, policy_id: str
) -> list[PolicyVersion]:
    result = await db.execute(
        select(PolicyVersion)
        .where(
            PolicyVersion.policy_id == uuid.UUID(policy_id),
            PolicyVersion.tenant_id == uuid.UUID(tenant_id),
        )
        .order_by(PolicyVersion.created_at.desc())
    )
    return list(result.scalars().all())


async def create_policy_version(
    db: AsyncSession,
    tenant_id: str,
    policy_id: str,
    content: str,
    authored_by_id: str,
    change_summary: Optional[str] = None,
    is_ai_drafted: bool = False,
) -> PolicyVersion:
    """
    Creates a new draft version from a policy.
    Version number is auto-incremented (minor bump by default).
    """
    # Get latest version to determine next version number
    versions = await list_policy_versions(db, tenant_id, policy_id)
    if versions:
        latest = versions[0].version_number
        parts = latest.split(".")
        parts[1] = str(int(parts[1]) + 1)
        next_version = ".".join(parts)
    else:
        next_version = "1.0.0"

    version = PolicyVersion(
        tenant_id=uuid.UUID(tenant_id),
        policy_id=uuid.UUID(policy_id),
        version_number=next_version,
        content=content,
        content_format="markdown",
        status="draft",
        authored_by_id=uuid.UUID(authored_by_id),
        is_ai_drafted=is_ai_drafted,
        change_summary=change_summary,
    )
    db.add(version)
    await db.flush()
    return version


async def submit_policy_for_review(
    db: AsyncSession,
    tenant_id: str,
    version_id: str,
    submitted_by_id: str,
) -> Optional[PolicyVersion]:
    result = await db.execute(
        select(PolicyVersion).where(
            PolicyVersion.id == uuid.UUID(version_id),
            PolicyVersion.tenant_id == uuid.UUID(tenant_id),
        )
    )
    version = result.scalar_one_or_none()
    if not version or version.status != "draft":
        return None
    version.status = "under_review"

    # Update parent policy status
    await db.execute(
        select(PolicyDocument).where(PolicyDocument.id == version.policy_id)
    )
    return version


async def approve_policy_version(
    db: AsyncSession,
    tenant_id: str,
    version_id: str,
    approved_by_id: str,
) -> Optional[PolicyVersion]:
    result = await db.execute(
        select(PolicyVersion).where(
            PolicyVersion.id == uuid.UUID(version_id),
            PolicyVersion.tenant_id == uuid.UUID(tenant_id),
        )
    )
    version = result.scalar_one_or_none()
    if not version or version.status not in ("under_review", "legal_review"):
        return None

    version.status = "approved"
    version.approved_by_id = uuid.UUID(approved_by_id)
    version.approved_at = _utcnow()
    return version


async def publish_policy_version(
    db: AsyncSession,
    tenant_id: str,
    policy_id: str,
    version_id: str,
    published_by_id: str,
    effective_from: Optional[datetime] = None,
) -> Optional[PolicyVersion]:
    """
    Publishes a policy version, making it the authoritative version.
    ONLY approved versions can be published.
    The HR assistant will use ONLY this version to answer questions.
    """
    result = await db.execute(
        select(PolicyVersion).where(
            PolicyVersion.id == uuid.UUID(version_id),
            PolicyVersion.tenant_id == uuid.UUID(tenant_id),
            PolicyVersion.policy_id == uuid.UUID(policy_id),
        )
    )
    version = result.scalar_one_or_none()
    if not version or version.status != "approved":
        return None

    now = _utcnow()
    version.status = "published"
    version.published_at = now
    version.effective_from = effective_from or now

    # Update the parent policy's published version pointer
    policy_result = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.id == uuid.UUID(policy_id),
            PolicyDocument.tenant_id == uuid.UUID(tenant_id),
        )
    )
    policy = policy_result.scalar_one_or_none()
    if policy:
        policy.current_published_version_id = version.id
        policy.status = "published"

    logger.info(
        "policy_published",
        tenant_id=tenant_id,
        policy_id=policy_id,
        version_id=version_id,
        version_number=version.version_number,
        published_by=published_by_id,
    )
    return version


async def get_published_policy_content(
    db: AsyncSession, tenant_id: str, slug: str
) -> Optional[str]:
    """
    Returns the published content of a policy by slug.
    Used by the HR support agent to answer employee questions.
    """
    policy = await get_policy_by_slug(db, tenant_id, slug)
    if not policy or not policy.current_published_version_id:
        return None

    result = await db.execute(
        select(PolicyVersion).where(
            PolicyVersion.id == policy.current_published_version_id,
            PolicyVersion.tenant_id == uuid.UUID(tenant_id),
        )
    )
    version = result.scalar_one_or_none()
    return version.content if version else None
