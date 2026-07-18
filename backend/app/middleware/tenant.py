"""
Tenant Context Middleware
Resolves tenant_id from JWT and sets PostgreSQL session variable for RLS.

SECURITY INVARIANT:
Every request to a tenant-protected endpoint MUST have a verified tenant_id
extracted from the JWT. The middleware NEVER accepts tenant_id from request body
or headers directly.
"""
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.logging import get_logger
from app.core.security import decode_token

logger = get_logger(__name__)

# Paths exempt from tenant resolution
PUBLIC_PATHS = {
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/docs",
    "/docs",
    "/api/redoc",
    "/api/openapi.json",
}


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Extracts tenant_id from JWT Bearer token and stores it in request.state.
    The tenant_id is later used by database sessions and agents.
    
    If tenant_id is missing on a protected route, execution is STOPPED
    and a security event is created.
    """

        # Allow public paths, but resolve tenant_id from slug header or JWT token
        if request.url.path == "/health":
            return await call_next(request)

        is_public = self._is_public_path(request.url.path) or request.url.path.startswith("/api/v1/public/")
        if is_public:
            tenant_slug = request.headers.get("X-Tenant-Slug") or "dev-tenant"
            from app.core.database import AsyncSessionLocal
            from sqlalchemy import select
            from app.models.tenant import Tenant
            async with AsyncSessionLocal() as session:
                stmt = select(Tenant.id).where(Tenant.company_slug == tenant_slug)
                res = await session.execute(stmt)
                t_id = res.scalar_one_or_none()
                if not t_id:
                    res2 = await session.execute(select(Tenant.id).limit(1))
                    t_id = res2.scalar_one_or_none()
                if t_id:
                    request.state.tenant_id = str(t_id)
            if not getattr(request.state, "tenant_id", None):
                token = self._extract_bearer_token(request)
                if token:
                    try:
                        payload = decode_token(token)
                        request.state.tenant_id = payload.get("tid")
                        request.state.user_id = payload.get("uid")
                        request.state.roles = payload.get("roles", [])
                    except Exception:
                        pass
            return await call_next(request)

        token = self._extract_bearer_token(request)

        if not token:
            # No token = no tenant context = blocked
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required."},
            )

        try:
            payload = decode_token(token)
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token."},
            )

        tenant_id = payload.get("tid")
        user_id = payload.get("uid")
        roles = payload.get("roles", [])

        if not tenant_id:
            # CRITICAL: Token exists but has no tenant_id claim
            # This is a security event
            logger.error(
                "TOKEN_MISSING_TENANT_ID",
                user_id=user_id,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid token: missing tenant context."},
            )

        # Attach to request state for downstream use
        request.state.tenant_id = tenant_id
        request.state.user_id = user_id
        request.state.roles = roles
        request.state.token_payload = payload

        response = await call_next(request)
        return response

    def _is_public_path(self, path: str) -> bool:
        return path in PUBLIC_PATHS or any(
            path.startswith(p) for p in ["/api/v1/jobs/public/", "/api/v1/apply/"]
        )

    def _extract_bearer_token(self, request: Request) -> str | None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        return None
