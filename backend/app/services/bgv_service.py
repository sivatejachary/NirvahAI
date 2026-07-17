"""
AI Background Verification Agent & Service
Coordinates verification workflows for candidates identity, criminal record, educational certificates, and employment history.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.bgv import BGVRequest
from app.core.logging import get_logger

logger = get_logger(__name__)


class BGVService:
    @staticmethod
    async def initiate_bgv_check(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        checks_required: list = ["identity", "education", "employment"]
    ) -> BGVRequest:
        """
        Creates background check tracking entry.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        bgv = BGVRequest(
            tenant_id=t_uuid,
            application_id=a_uuid,
            status="INITIATED",
            verification_types=checks_required,
            results={"checks_status": {c: "PENDING" for c in checks_required}}
        )
        db.add(bgv)
        await db.flush()
        
        logger.info(f"BGV_CHECK_INITIATED: Application {application_id}")
        return bgv

    @staticmethod
    async def update_check_status(
        db: AsyncSession,
        tenant_id: str,
        bgv_id: str,
        check_name: str,
        outcome: str,
        notes: str
    ) -> Optional[BGVRequest]:
        """
        Registers result metrics for BGV check.
        """
        b_uuid = uuid.UUID(bgv_id) if isinstance(bgv_id, str) else bgv_id
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        
        stmt = select(BGVRequest).where(
            BGVRequest.id == b_uuid,
            BGVRequest.tenant_id == t_uuid
        )
        bgv = (await db.execute(stmt)).scalar_one_or_none()
        if not bgv:
            return None
            
        res = bgv.results or {}
        chk_status = res.get("checks_status", {})
        chk_status[check_name] = outcome
        
        res["checks_status"] = chk_status
        res[f"{check_name}_details"] = {"completed_at": datetime.now(timezone.utc).isoformat(), "notes": notes}
        bgv.results = res
        
        # If all checks finished, calculate final status
        all_checks = bgv.verification_types or []
        completed = [chk_status.get(c) for c in all_checks if chk_status.get(c) in ["PASSED", "FAILED"]]
        
        if len(completed) == len(all_checks):
            if "FAILED" in [chk_status.get(c) for c in all_checks]:
                bgv.status = "FAILED"
            else:
                bgv.status = "PASSED"
            logger.info(f"BGV_CHECK_COMPLETED: {bgv_id} - Outcome: {bgv.status}")
            
        await db.flush()
        return bgv
