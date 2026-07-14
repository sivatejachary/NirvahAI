"""
Rate Limiting Middleware
Uses Redis sliding window counters with tenant-aware limits.
"""
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Public endpoints get stricter limits
PUBLIC_PREFIX = "/api/v1/public/"
APPLY_PREFIX = "/api/v1/apply/"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-backed rate limiter.
    - Authenticated requests: per user, per tenant
    - Public/apply endpoints: per IP with stricter limits
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            from app.core.redis import get_redis
            redis = get_redis()
        except RuntimeError:
            # Redis not ready (startup), pass through
            return await call_next(request)

        path = request.url.path
        ip = request.client.host if request.client else "unknown"

        # Determine rate limit bucket
        if path.startswith(PUBLIC_PREFIX) or path.startswith(APPLY_PREFIX):
            bucket = f"ratelimit:public:{ip}"
            limit = settings.PUBLIC_RATE_LIMIT_PER_MINUTE
        else:
            user_id = getattr(request.state, "user_id", ip)
            bucket = f"ratelimit:auth:{user_id}"
            limit = settings.RATE_LIMIT_PER_MINUTE

        count = await redis.incr(bucket)
        if count == 1:
            await redis.expire(bucket, 60)

        if count > limit:
            logger.warning(
                "rate_limit_exceeded",
                bucket=bucket,
                count=count,
                limit=limit,
                path=path,
                ip=ip,
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - count))
        return response
