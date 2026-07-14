"""
Sandbox & Testing Router
Phase: Utility endpoints for health check and sandbox management
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import get_tenant_id, require_role

router = APIRouter(prefix="/sandbox", tags=["Sandbox & Testing"])

_role_guard = Depends(require_role("tenant_admin"))


@router.get("/status")
async def sandbox_status(
    tenant_id: str = Depends(get_tenant_id),
    _: None = _role_guard,
):
    """Get sandbox environment status."""
    try:
        from app.core.config import settings
        env = getattr(settings, "APP_ENV", "development")
    except Exception:
        env = "development"

    return {
        "status": "healthy",
        "tenant_id": str(tenant_id),
        "environment": env,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.post("/seed")
async def seed_sandbox(
    _: None = _role_guard,
):
    """Seed sandbox with test data (stub)."""
    return {
        "message": "Seed data created",
        "created": {
            "jobs": 0,
            "applications": 0,
            "note": "Manual seeding not implemented - use the UI to create test data",
        },
    }


@router.delete("/reset")
async def reset_sandbox(
    _: None = _role_guard,
):
    """Reset sandbox data (dry-run)."""
    return {
        "message": "Sandbox data cleared (dry run)",
        "warning": "This is a dry-run. Implement actual deletion carefully.",
    }
