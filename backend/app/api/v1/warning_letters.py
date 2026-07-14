"""
Warning Letters API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.warning_letter import WarningLetter

router = APIRouter(prefix="/warning-letters", tags=["Warning Letters"])


class GenerateWarningRequest(BaseModel):
    employee_name: str
    employee_email: str
    violation_type: str  # ATTENDANCE | PERFORMANCE | CONDUCT | POLICY | OTHER
    description: str
    issued_by: str


def _generate_warning_letter(employee_name: str, violation_type: str, description: str, issued_by: str) -> str:
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    return f"""WARNING LETTER

Date: {date_str}

To: {employee_name}

Subject: Formal Warning — {violation_type.replace('_', ' ').title()}

Dear {employee_name},

This letter serves as a formal written warning regarding: {violation_type.replace('_', ' ').title()}.

Details of the Concern:
{description}

This behavior is in violation of our company policies and is not acceptable. We expect immediate improvement in the areas mentioned above.

Failure to improve may result in further disciplinary action, up to and including termination of employment.

Please sign and return a copy of this letter to acknowledge receipt. Your signature does not necessarily indicate agreement with the contents.

Issued by: {issued_by}
Date: {date_str}

____________________________
Employee Signature & Date"""


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_warning_letter(
    body: GenerateWarningRequest,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    letter_text = _generate_warning_letter(
        body.employee_name,
        body.violation_type,
        body.description,
        body.issued_by
    )
    
    letter = WarningLetter(
        employee_id=uuid.uuid4(),  # Mock directory user ID
        employee_name=body.employee_name,
        employee_email=body.employee_email,
        violation_type=body.violation_type,
        description=body.description,
        letter_content=letter_text,
        issued_by=body.issued_by,
        status="DRAFT",
        tenant_id=tid,
    )
    db.add(letter)
    await db.flush()
    return letter


@router.get("")
async def get_warning_letters(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(WarningLetter).where(WarningLetter.tenant_id == tid).order_by(WarningLetter.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{letter_id}")
async def get_warning_letter(
    letter_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(WarningLetter).where(WarningLetter.id == letter_id, WarningLetter.tenant_id == tid)
    result = await db.execute(stmt)
    letter = result.scalar_one_or_none()
    if not letter:
        raise HTTPException(status_code=404, detail="Warning letter not found")
    return letter


@router.patch("/{letter_id}/issue")
async def issue_warning_letter(
    letter_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(WarningLetter).where(WarningLetter.id == letter_id, WarningLetter.tenant_id == tid)
    result = await db.execute(stmt)
    letter = result.scalar_one_or_none()
    if not letter:
        raise HTTPException(status_code=404, detail="Warning letter not found")
        
    letter.status = "ISSUED"
    letter.issued_at = datetime.utcnow()
    await db.flush()
    return letter


@router.patch("/{letter_id}/acknowledge")
async def acknowledge_warning_letter(
    letter_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(WarningLetter).where(WarningLetter.id == letter_id, WarningLetter.tenant_id == tid)
    result = await db.execute(stmt)
    letter = result.scalar_one_or_none()
    if not letter:
        raise HTTPException(status_code=404, detail="Warning letter not found")
        
    letter.status = "ACKNOWLEDGED"
    letter.acknowledged_at = datetime.utcnow()
    await db.flush()
    return letter
