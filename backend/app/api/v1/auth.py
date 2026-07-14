"""
Auth API Router
Handles: register (tenant + admin), login, token refresh, logout.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession
from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.tenant import CompanySettings, Tenant
from app.models.user import RefreshToken, Role, User
from app.services.audit import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = get_logger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class TenantRegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    company_slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    admin_full_name: str = Field(..., min_length=2, max_length=500)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=10)
    industry: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str = Field(..., description="Company slug to identify the tenant")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    tenant_id: str
    user_id: str
    roles: list[str]


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new company tenant and admin user",
)
async def register_tenant(
    body: TenantRegisterRequest,
    request: Request,
    db: DBSession,
):
    """
    Creates a new tenant (company) and the first admin user.
    The tenant starts in 'pending_setup' status.
    """
    # Check slug uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.company_slug == body.company_slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Company slug '{body.company_slug}' is already taken.",
        )

    # Check email uniqueness across users
    existing_email = await db.execute(
        select(User).where(User.email == str(body.admin_email))
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Create tenant
    tenant = Tenant(
        company_name=body.company_name,
        company_slug=body.company_slug,
        industry=body.industry,
        status="pending_setup",
    )
    db.add(tenant)
    await db.flush()  # Get the tenant.id

    # Create default company settings
    company_settings = CompanySettings(
        tenant_id=tenant.id,
        autonomy_level="ASSISTED",
    )
    db.add(company_settings)

    # Get or create tenant_admin role
    role_result = await db.execute(
        select(Role).where(Role.name == "tenant_admin")
    )
    admin_role = role_result.scalar_one_or_none()
    if not admin_role:
        admin_role = Role(
            name="tenant_admin",
            display_name="Tenant Administrator",
            description="Full administrative access within a tenant",
        )
        db.add(admin_role)
        await db.flush()

    # Create admin user
    admin_user = User(
        tenant_id=tenant.id,
        email=str(body.admin_email),
        password_hash=hash_password(body.admin_password),
        full_name=body.admin_full_name,
        status="active",
    )
    admin_user.roles.append(admin_role)
    db.add(admin_user)
    await db.flush()

    # Audit log
    audit = AuditService(db)
    await audit.log(
        action="tenant.registered",
        actor_id=str(admin_user.id),
        actor_type="user",
        tenant_id=str(tenant.id),
        entity_type="tenant",
        entity_id=str(tenant.id),
        reason_code="TENANT_SELF_REGISTRATION",
        output_summary={"company_slug": body.company_slug, "admin_email": str(body.admin_email)},
        ip_address=request.client.host if request.client else None,
    )

    logger.info(
        "tenant_registered",
        tenant_id=str(tenant.id),
        slug=body.company_slug,
        admin_email=str(body.admin_email),
    )

    return {
        "message": "Tenant and admin account created successfully.",
        "tenant_id": str(tenant.id),
        "company_slug": body.company_slug,
        "status": "pending_setup",
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: DBSession,
):
    """Authenticate user and return JWT tokens."""
    # Resolve tenant by slug
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.company_slug == body.tenant_slug)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if tenant.status in ("suspended", "offboarded"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not available.",
        )

    # Find user within this tenant only
    user_result = await db.execute(
        select(User).where(
            User.email == str(body.email),
            User.tenant_id == tenant.id,
        )
    )
    user = user_result.scalar_one_or_none()

    # Constant-time comparison to prevent timing attacks
    if not user or not verify_password(body.password, user.password_hash):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.status = "locked"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}.",
        )

    # Reset failed attempts on success
    user.failed_login_attempts = 0

    # Eagerly load roles
    from sqlalchemy.orm import selectinload
    user_with_roles = await db.execute(
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user.id)
    )
    user = user_with_roles.scalar_one()

    role_names = user.role_names
    access_token = create_access_token(
        subject=str(user.email),
        tenant_id=str(tenant.id),
        user_id=str(user.id),
        roles=role_names,
    )
    refresh_token = create_refresh_token(
        subject=str(user.email),
        tenant_id=str(tenant.id),
        user_id=str(user.id),
    )

    # Store refresh token hash
    from app.core.security import hash_token
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=str(
            datetime.now(tz=timezone.utc)
            + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        ),
    )
    db.add(rt)

    audit = AuditService(db)
    await audit.log(
        action="auth.login",
        actor_id=str(user.id),
        actor_type="user",
        tenant_id=str(tenant.id),
        entity_type="user",
        entity_id=str(user.id),
        reason_code="USER_LOGIN",
        ip_address=request.client.host if request.client else None,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        tenant_id=str(tenant.id),
        user_id=str(user.id),
        roles=role_names,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, db: DBSession):
    """Exchange a valid refresh token for new access + refresh tokens."""
    try:
        payload = decode_token(body.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not a refresh token.",
        )

    user_id = payload.get("uid")
    tenant_id = payload.get("tid")

    from sqlalchemy.orm import selectinload
    user_result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="User not found or inactive.")

    access_token = create_access_token(
        subject=str(user.email),
        tenant_id=str(tenant_id),
        user_id=str(user.id),
        roles=user.role_names,
    )
    new_refresh_token = create_refresh_token(
        subject=str(user.email),
        tenant_id=str(tenant_id),
        user_id=str(user.id),
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        tenant_id=str(tenant_id),
        user_id=str(user.id),
        roles=user.role_names,
    )
