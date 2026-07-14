"""
AI Usage Tracking Models
Enforces token cost governance and budget limits per tenant.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text, text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import utcnow, TenantMixin


class AIUsageLog(Base, TenantMixin):
    """
    Log of every AI call made by a tenant.
    Enables cost calculation and daily/monthly budget gating.
    """
    __tablename__ = "ai_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. resume_parsing, mcq_generation
    
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=text("now()"),
        index=True
    )
