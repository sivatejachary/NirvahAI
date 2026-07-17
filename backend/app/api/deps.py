"""
FastAPI Dependencies
Reusable injectable dependencies for auth, tenant context, and DB sessions.
"""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.core.security import decode_token
from app.models.user import User

logger = get_logger(__name__)

security_scheme = HTTPBearer()


async def get_db(request: Request) -> AsyncSession:
    """
    Dependency that yields an async DB session with the tenant context
    already set (via PostgreSQL SET LOCAL) to enable Row-Level Security.
    """
    tenant_id = getattr(request.state, "tenant_id", None)
    async with AsyncSessionLocal() as session:
        try:
            if tenant_id and "sqlite" not in str(session.bind.url):
                from sqlalchemy import text
                await session.execute(
                    text("SELECT set_config('app.current_tenant_id', :tid, true)"),
                    {"tid": str(tenant_id)},
                )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_tenant_id(request: Request) -> str:
    """Extract tenant_id from request state (set by TenantContextMiddleware)."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing tenant context.",
        )
    return tenant_id


def get_current_user_id(request: Request) -> str:
    """Extract user_id from request state."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user_id


def get_current_roles(request: Request) -> list[str]:
    """Extract role list from request state."""
    return getattr(request.state, "roles", [])


def require_permission(permission: str):
    """
    Dependency factory for database-driven permission checking.
    Usage: Depends(require_permission("candidates:read"))
    """
    async def checker(
        request: Request,
        roles: list[str] = Depends(get_current_roles)
    ) -> None:
        if "platform_admin" in roles or "tenant_admin" in roles:
            return  # System and company admins bypass explicit permission checks

        # Attempt database-driven RBAC lookup first
        try:
            tenant_id = getattr(request.state, "tenant_id", None)
            if tenant_id and "sqlite" not in str(AsyncSessionLocal.kw.get("bind", "")):
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import select
                    from app.models.user import Role, Permission
                    stmt = (
                        select(Permission.id)
                        .join(Permission.roles)
                        .where(
                            Permission.name == permission,
                            Role.name.in_(roles)
                        )
                    )
                    res = await session.execute(stmt)
                    if res.scalar_one_or_none() is not None:
                        return
        except Exception as e:
            logger.debug("Database permission lookup fallback", error=str(e), permission=permission)

        # Fallback to standard role-permission mapping
        allowed_roles = _permission_to_roles.get(permission, [])
        if not any(role in roles for role in allowed_roles + ["platform_admin", "tenant_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}",
            )
    return checker


def require_role(*required_roles: str):
    """Dependency factory for role checking."""
    def checker(roles: list[str] = Depends(get_current_roles)) -> None:
        if "platform_admin" in roles:
            return  # Platform admins bypass
        if not any(role in roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {list(required_roles)}",
            )
    return checker


# Permission-to-role mapping (simplified; full RBAC loads from DB in production)
_permission_to_roles: dict[str, list[str]] = {
    "tenants:read": ["platform_admin"],
    "tenants:create": ["platform_admin"],
    "tenants:update": ["platform_admin"],
    "jobs:create": ["tenant_admin", "hr_manager", "hr_recruiter"],
    "jobs:read": ["tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager", "interviewer"],
    "candidates:read": ["tenant_admin", "hr_manager", "hr_recruiter", "hiring_manager"],
    "candidates:manage": ["tenant_admin", "hr_manager", "hr_recruiter"],
    "assessments:read": ["tenant_admin", "hr_manager", "hr_recruiter"],
    "offers:create": ["tenant_admin", "hr_manager"],
    "employees:read": ["tenant_admin", "hr_manager"],
    "audit:read": ["tenant_admin", "platform_admin"],
    "settings:manage": ["tenant_admin"],
}

# Type aliases for cleaner dependency injection
TenantId = Annotated[str, Depends(get_tenant_id)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
CurrentRoles = Annotated[list[str], Depends(get_current_roles)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
