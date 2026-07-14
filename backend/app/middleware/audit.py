"""
Audit Logging Middleware
Records every API request to the audit log asynchronously.
"""
import time
import uuid
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger

logger = get_logger(__name__)

# Paths excluded from audit logging (high-frequency health checks)
AUDIT_EXCLUDED_PATHS = {"/health", "/metrics"}


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs every significant API request with:
    - tenant_id
    - user_id
    - action (path + method)
    - status code
    - duration
    - correlation_id

    Non-blocking: uses background task for actual DB write.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in AUDIT_EXCLUDED_PATHS:
            return await call_next(request)

        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start_time) * 1000, 2)

        tenant_id = getattr(request.state, "tenant_id", None)
        user_id = getattr(request.state, "user_id", None)

        logger.info(
            "api_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            tenant_id=tenant_id,
            user_id=user_id,
            correlation_id=correlation_id,
            ip=request.client.host if request.client else None,
        )

        # Add correlation ID to response headers for distributed tracing
        response.headers["X-Correlation-ID"] = correlation_id

        return response
