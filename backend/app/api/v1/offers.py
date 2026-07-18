"""
Offer Engine API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.offer import Offer
from app.models.application import Application

router = APIRouter(prefix="/offers", tags=["Offer Engine"])


class CreateOfferRequest(BaseModel):
    application_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    job_title: str
    department: Optional[str] = None
    base_salary: Optional[float] = None
    joining_date: Optional[datetime] = None
    compensation_details: Optional[dict] = None


class OfferResponse(BaseModel):
    decision: str  # ACCEPTED | DECLINED


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_offer(
    body: CreateOfferRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    # Verify application exists
    app_query = await db.execute(select(Application).where(Application.id == body.application_id, Application.tenant_id == tid))
    app = app_query.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    offer = Offer(
        application_id=body.application_id,
        candidate_name=body.candidate_name,
        candidate_email=body.candidate_email,
        job_title=body.job_title,
        department=body.department,
        base_salary=body.base_salary,
        joining_date=body.joining_date,
        compensation_details=body.compensation_details or {},
        status="DRAFT",
        tenant_id=tid,
    )
    db.add(offer)
    await db.flush()
    
    return offer


@router.get("")
async def get_offers(
    db: DBSession,
    tenant_id: TenantId,
    status: Optional[str] = None,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer).where(Offer.tenant_id == tid)
    if status:
        stmt = stmt.where(Offer.status == status)
    stmt = stmt.order_by(Offer.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{offer_id}")
async def get_offer(
    offer_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer).where(Offer.id == offer_id, Offer.tenant_id == tid)
    result = await db.execute(stmt)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.post("/{offer_id}/send")
async def send_offer(
    offer_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer).where(Offer.id == offer_id, Offer.tenant_id == tid)
    result = await db.execute(stmt)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    offer.status = "SENT"
    offer.sent_at = datetime.utcnow()
    await db.flush()

    from app.services.integration_event import EventBusService, EventCatalog
    await EventBusService.publish_event(
        event_type=EventCatalog.OFFER_CREATED,
        company_id=tenant_id,
        application_id=str(offer.application_id),
        payload={
            "offer_id": str(offer.id),
            "application_id": str(offer.application_id),
            "candidate_name": offer.candidate_name,
            "candidate_email": offer.candidate_email,
            "job_title": offer.job_title,
            "base_salary": offer.base_salary,
            "offer_letter_text": offer.offer_letter_text
        }
    )
    return offer


@router.patch("/{offer_id}/respond")
async def respond_to_offer(
    offer_id: uuid.UUID,
    body: OfferResponse,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer).where(Offer.id == offer_id, Offer.tenant_id == tid)
    result = await db.execute(stmt)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    offer.status = body.decision
    offer.responded_at = datetime.utcnow()
    await db.flush()
    
    # Also update application status
    app_stmt = select(Application).where(Application.id == offer.application_id, Application.tenant_id == tid)
    app_result = await db.execute(app_stmt)
    app = app_result.scalar_one_or_none()
    if app:
        if body.decision == "ACCEPTED":
            app.status = "COMPLETED"
        else:
            app.status = "REJECTED"
        await db.flush()
        
    return offer


@router.post("/{offer_id}/generate-letter")
async def generate_letter(
    offer_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager", "hr_recruiter")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(Offer).where(Offer.id == offer_id, Offer.tenant_id == tid)
    result = await db.execute(stmt)
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    salary_text = f"₹{offer.base_salary:,.2f} per annum" if offer.base_salary else "To be discussed"
    joining_date_text = offer.joining_date.strftime("%B %d, %Y") if offer.joining_date else "To be determined"
    
    offer_letter_template = f"""Dear {offer.candidate_name},

We are delighted to offer you the position of {offer.job_title} at our organization.

Position Details:
- Role: {offer.job_title}
- Department: {offer.department or "General"}
- Starting Salary: {salary_text}
- Joining Date: {joining_date_text}

This offer is subject to successful completion of background verification and signing of the employment agreement.

Please confirm your acceptance within 7 days of receiving this offer.

We look forward to having you as part of our team.

Warm regards,
HR Department"""

    offer.offer_letter_text = offer_letter_template
    await db.flush()
    return offer
