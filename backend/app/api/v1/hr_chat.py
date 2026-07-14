"""
Employee HR Chat / Self Service API Router
"""
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, TenantId, require_role
from app.models.hr_chat import HRChatSession

router = APIRouter(prefix="/hr-chat", tags=["Employee HR Chat"])


class CreateChatSessionRequest(BaseModel):
    employee_name: str
    employee_email: str
    channel: str = "CHAT"  # CHAT | VOICE
    topic: Optional[str] = "General Inquiry"


class SendMessageRequest(BaseModel):
    content: str


def _generate_hr_response(message: str, topic: str) -> str:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["leave", "vacation", "holiday", "pto"]):
        return "Our leave policy provides 18 days of paid annual leave, 10 sick days, and 3 personal days per year. You can apply for leave through the HR portal or by emailing hr@company.com."
    elif any(w in msg_lower for w in ["salary", "pay", "payroll", "payslip"]):
        return "Salaries are processed on the last working day of each month. For payslip queries, please contact payroll@company.com or visit the employee self-service portal."
    elif any(w in msg_lower for w in ["policy", "rule", "guideline"]):
        return "Our company policies are documented in the Employee Handbook available on the intranet. Key policies include: Code of Conduct, IT Usage, Remote Work, and Anti-Harassment policies."
    elif any(w in msg_lower for w in ["benefit", "insurance", "health", "medical"]):
        return "We offer comprehensive health insurance for employees and dependents, dental coverage, vision care, and life insurance. Contact benefits@company.com for enrollment details."
    else:
        return f"Thank you for reaching out. Regarding your query about '{topic or message[:50]}', our HR team will review and respond within 1 business day. For urgent matters, please call the HR helpdesk."


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    body: CreateChatSessionRequest,
    db: DBSession,
    tenant_id: TenantId,
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    
    session = HRChatSession(
        employee_id=uuid.uuid4(),  # Mock directory user ID
        employee_name=body.employee_name,
        employee_email=body.employee_email,
        channel=body.channel,
        topic=body.topic,
        messages=[],
        status="OPEN",
        tenant_id=tid,
    )
    db.add(session)
    await db.flush()
    return session


@router.post("/sessions/{session_id}/message")
async def send_chat_message(
    session_id: uuid.UUID,
    body: SendMessageRequest,
    db: DBSession,
    tenant_id: TenantId,
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(HRChatSession).where(HRChatSession.id == session_id, HRChatSession.tenant_id == tid)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    now_iso = datetime.utcnow().isoformat()
    
    # Python JSONB list modification
    # We must replace or flag SQLAlchemy that the list changed.
    # To do this safely, we construct a new list and re-assign.
    updated_messages = list(session.messages) if session.messages else []
    
    user_msg = {"role": "user", "content": body.content, "timestamp": now_iso}
    updated_messages.append(user_msg)
    
    ai_response_text = _generate_hr_response(body.content, session.topic)
    assistant_msg = {"role": "assistant", "content": ai_response_text, "timestamp": now_iso}
    updated_messages.append(assistant_msg)
    
    session.messages = updated_messages
    await db.flush()
    
    return {
        "user_message": user_msg,
        "assistant_response": assistant_msg
    }


@router.get("/sessions")
async def get_chat_sessions(
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(HRChatSession).where(HRChatSession.tenant_id == tid).order_by(HRChatSession.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(HRChatSession).where(HRChatSession.id == session_id, HRChatSession.tenant_id == tid)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.patch("/sessions/{session_id}/resolve")
async def resolve_chat_session(
    session_id: uuid.UUID,
    db: DBSession,
    tenant_id: TenantId,
    _role: None = Depends(require_role("tenant_admin", "hr_manager")),
):
    tid = uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    stmt = select(HRChatSession).where(HRChatSession.id == session_id, HRChatSession.tenant_id == tid)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    session.status = "RESOLVED"
    session.resolved_at = datetime.utcnow()
    await db.flush()
    return session
