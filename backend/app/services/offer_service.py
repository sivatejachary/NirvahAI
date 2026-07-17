"""
AI Offer Agent & Service
Generates, tracks, and triggers approval workflows for candidate job offer letters.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.offer import OfferLetter
from app.core.logging import get_logger

logger = get_logger(__name__)


class OfferService:
    @staticmethod
    async def generate_and_issue_offer(
        db: AsyncSession,
        tenant_id: str,
        application_id: str,
        base_salary_usd: float,
        bonus_usd: float,
        equity_shares: int = 0
    ) -> OfferLetter:
        """
        Creates offer letter draft and triggers approval chain.
        """
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        a_uuid = uuid.UUID(application_id) if isinstance(application_id, str) else application_id
        
        offer = OfferLetter(
            tenant_id=t_uuid,
            application_id=a_uuid,
            base_salary=base_salary_usd,
            sign_bonus=bonus_usd,
            stock_options=equity_shares,
            status="DRAFT",
            approval_chain={"steps": ["manager_approval", "finance_approval"]},
            current_approver="manager_approval",
            valid_until=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(offer)
        await db.flush()
        
        logger.info(f"OFFER_GENERATED: Application {application_id} - Base: {base_salary_usd}")
        return offer

    @staticmethod
    async def approve_step(db: AsyncSession, tenant_id: str, offer_id: str, step_name: str) -> Optional[OfferLetter]:
        """
        Advances the approval chain for offer letter.
        """
        o_uuid = uuid.UUID(offer_id) if isinstance(offer_id, str) else offer_id
        t_uuid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
        
        stmt = select(OfferLetter).where(
            OfferLetter.id == o_uuid,
            OfferLetter.tenant_id == t_uuid
        )
        offer = (await db.execute(stmt)).scalar_one_or_none()
        if not offer:
            return None
            
        if offer.status != "DRAFT":
            return offer
            
        steps = offer.approval_chain.get("steps", [])
        try:
            current_idx = steps.index(step_name)
            if current_idx == len(steps) - 1:
                # Last step cleared -> Offer ready to release
                offer.status = "APPROVED"
                offer.current_approver = None
                logger.info(f"OFFER_FULLY_APPROVED: {offer_id}")
            else:
                offer.current_approver = steps[current_idx + 1]
        except ValueError:
            pass
            
        await db.flush()
        return offer
