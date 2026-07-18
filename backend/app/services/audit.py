"""
Audit Service
Writes structured audit log entries to the database.
"""
import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog, SecurityEvent


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: str,
        actor_type: str,
        actor_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        reason_code: Optional[str] = None,
        reason_summary: Optional[str] = None,
        input_references: Optional[dict[str, Any]] = None,
        output_summary: Optional[dict[str, Any]] = None,
        agent_name: Optional[str] = None,
        agent_version: Optional[str] = None,
        prompt_version: Optional[str] = None,
        workflow_version: Optional[str] = None,
        model_version: Optional[str] = None,
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        status: str = "success",
    ) -> AuditLog:
        def _to_uuid(val):
            if not val:
                return None
            return val if isinstance(val, uuid.UUID) else uuid.UUID(str(val))

        try:
            entry = AuditLog(
                tenant_id=_to_uuid(tenant_id),
                actor_id=_to_uuid(actor_id),
                actor_type=actor_type,
                action=action,
                entity_type=entity_type,
                entity_id=_to_uuid(entity_id),
                reason_code=reason_code,
                reason_summary=reason_summary,
                input_references=input_references,
                output_summary=output_summary,
                agent_name=agent_name,
                agent_version=agent_version,
                prompt_version=prompt_version,
                workflow_version=workflow_version,
                model_version=model_version,
                correlation_id=correlation_id,
                causation_id=causation_id,
                ip_address=ip_address,
                user_agent=user_agent,
                status=status,
            )
            self.db.add(entry)
            return entry
        except Exception as e:
            # Audit must never bring down the application
            import logging
            logging.getLogger(__name__).error(f"Audit log write failed: {e}")
            raise

    async def log_security_event(
        self,
        event_type: str,
        severity: str = "medium",
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        path: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> SecurityEvent:
        """Write a security event."""
        event = SecurityEvent(
            tenant_id=uuid.UUID(tenant_id) if tenant_id else None,
            event_type=event_type,
            severity=severity,
            user_id=uuid.UUID(user_id) if user_id else None,
            ip_address=ip_address,
            user_agent=user_agent,
            path=path,
            details=details,
        )
        self.db.add(event)
        return event


def get_audit_service(db: AsyncSession) -> AuditService:
    return AuditService(db)
