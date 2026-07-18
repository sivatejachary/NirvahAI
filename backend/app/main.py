"""
HR OS - FastAPI Application Entry Point
Multi-Tenant Autonomous AI HR Operating System
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.core.redis import init_redis, close_redis
from app.core.logging import setup_logging, get_logger
from app.middleware.tenant import TenantContextMiddleware
from app.middleware.audit import AuditLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.api.v1 import router as api_v1_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    setup_logging()
    logger.info("Starting HR OS API", version="1.0.0", env=settings.APP_ENV)
    
    # Initialize database connection pool
    try:
        await init_db()
        logger.info("Database pool initialized")
    except Exception as e:
        logger.error(f"Non-fatal init_db startup exception: {e}")

    # Initialize Redis connection
    try:
        await init_redis()
        logger.info("Redis connection initialized")
        # Start integration event bus background worker loop durably
        from app.services.integration_event import EventBusService
        EventBusService.ensure_worker_running()
    except Exception as e:
        logger.error(f"Non-fatal init_redis startup exception: {e}")

    yield

    # Cleanup
    try:
        await close_redis()
    except Exception:
        pass
    logger.info("HR OS API shutting down")


def create_application() -> FastAPI:
    app = FastAPI(
        title="HR OS — Autonomous AI HR Operating System",
        description=(
            "Multi-tenant autonomous AI platform for the complete workforce lifecycle. "
            "Manages hiring, onboarding, employee support, learning, performance, and offboarding."
        ),
        version="1.0.0",
        docs_url="/api/docs" if settings.APP_DEBUG else None,
        redoc_url="/api/redoc" if settings.APP_DEBUG else None,
        openapi_url="/api/openapi.json" if settings.APP_DEBUG else None,
        lifespan=lifespan,
    )

    # ── Trusted Host ─────────────────────────────────────────────────────────
    if not settings.APP_DEBUG:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    app.add_middleware(RateLimitMiddleware)

    # ── Audit Logging ─────────────────────────────────────────────────────────
    app.add_middleware(AuditLoggingMiddleware)

    # ── Tenant Context Resolution ─────────────────────────────────────────────
    app.add_middleware(TenantContextMiddleware)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_v1_router, prefix="/api/v1")

    # ── Global Exception Handlers ─────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Unhandled exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal error occurred. It has been logged."},
        )

    @app.get("/health", tags=["System"])
    async def health():
        return {
            "status": "ok",
            "service": "hros-api",
            "version": "1.0.0",
            "allowed_origins": settings.ALLOWED_ORIGINS
        }

    # ── Docs Redirect ─────────────────────────────────────────────────────────
    @app.get("/docs", include_in_schema=False)
    async def docs_redirect():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/api/docs")

    return app


app = create_application()
