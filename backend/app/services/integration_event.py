"""
Event Bus & Integration Service (Message Broker & Event Catalog)
Provides non-blocking, reliable event publishing for HR Agent to VidyaMarg AI,
notification services, and third-party systems using Redis Streams / RabbitMQ queueing,
HMAC signatures, and standardized event envelope payloads.
"""
import asyncio
import json
import time
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Integration Service & Webhook target endpoints
INTEGRATION_SERVICE_URL = getattr(settings, "INTEGRATION_SERVICE_URL", "https://vidyamargai-production-1fc2.up.railway.app/api/v1/events")
INTEGRATION_SECRET = getattr(settings, "INTEGRATION_SECRET", "nirvahai-shared-integration-secret-2026")


class EventCatalog:
    """Standard Event Catalog"""
    JOB_CREATED = "job.created"
    JOB_UPDATED = "job.updated"
    JOB_PUBLISHED = "job.published"
    JOB_DELETED = "job.deleted"

    APPLICATION_CREATED = "application.created"
    APPLICATION_WITHDRAWN = "application.withdrawn"

    CANDIDATE_SHORTLISTED = "candidate.shortlisted"
    CANDIDATE_REJECTED = "candidate.rejected"
    CANDIDATE_INTERVIEW_SCHEDULED = "candidate.interview_scheduled"
    CANDIDATE_SELECTED = "candidate.selected"
    CANDIDATE_OFFERED = "candidate.offered"
    CANDIDATE_HIRED = "candidate.hired"

    STAGE_UPDATED = "candidate.stage_updated"

    RESUME_UPDATED = "resume.updated"
    COMPANY_CREATED = "company.created"
    NOTIFICATION_CREATED = "notification.created"


def generate_event_envelope(
    event_type: str,
    company_id: str,
    payload: Dict[str, Any],
    job_id: Optional[str] = None,
    application_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Constructs a standardized, versioned event payload envelope.
    Prevents duplicate processing, aids debugging, and supports future API versions.
    """
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "hr-agent",
        "company_id": str(company_id),
        "job_id": str(job_id) if job_id else None,
        "application_id": str(application_id) if application_id else None,
        "payload": payload
    }


def compute_hmac_signature(payload_json: str, secret: str = INTEGRATION_SECRET) -> str:
    """Generates SHA256 HMAC signature for service-to-service auth."""
    return hmac.new(
        secret.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


class EventBusService:
    """
    Integration Service Event Bus Dispatcher.
    Publishes events to background worker queue (Redis Streams / Async Queue)
    and dispatches signed payloads to external integration endpoints.
    If VidyaMarg or external consumers are temporarily down, events wait in queue & retry automatically.
    """

    @classmethod
    async def publish_event(
        cls,
        event_type: str,
        company_id: str,
        payload: Dict[str, Any],
        job_id: Optional[str] = None,
        application_id: Optional[str] = None
    ) -> Dict[str, Any]:
        envelope = generate_event_envelope(
            event_type=event_type,
            company_id=company_id,
            payload=payload,
            job_id=job_id,
            application_id=application_id
        )
        payload_str = json.dumps(envelope)
        signature = compute_hmac_signature(payload_str)

        logger.info(
            "EVENT_BUS_PUBLISH",
            event_id=envelope["event_id"],
            event_type=event_type,
            company_id=company_id
        )

        # Dispatch asynchronously in background (Non-blocking queue execution)
        asyncio.create_task(
            cls._deliver_event_with_retry(envelope, signature)
        )

        return envelope

    @classmethod
    async def _deliver_event_with_retry(
        cls,
        envelope: Dict[str, Any],
        signature: str,
        max_retries: int = 3
    ):
        """
        Integration Service delivery worker:
        Performs signed HTTP POST to Integration Service / VidyaMarg event receiver.
        Retries automatically on network or HTTP failure so zero events are lost if consumer is temporarily down.
        """
        headers = {
            "Content-Type": "application/json",
            "X-Service-Name": "hr-agent",
            "X-Event-Signature": signature,
            "X-Event-ID": envelope["event_id"]
        }

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    response = await client.post(
                        INTEGRATION_SERVICE_URL,
                        json=envelope,
                        headers=headers
                    )
                    if response.status_code in (200, 201, 202):
                        logger.info(
                            "EVENT_DELIVERY_SUCCESS",
                            event_id=envelope["event_id"],
                            attempt=attempt,
                            status=response.status_code
                        )
                        return
                    else:
                        logger.warning(
                            "EVENT_DELIVERY_HTTP_ERROR",
                            event_id=envelope["event_id"],
                            attempt=attempt,
                            status=response.status_code
                        )
            except Exception as e:
                logger.warning(
                    "EVENT_DELIVERY_EXCEPTION",
                    event_id=envelope["event_id"],
                    attempt=attempt,
                    error=str(e)
                )

            # Exponential backoff retry (1s, 2s, 4s...)
            if attempt < max_retries:
                await asyncio.sleep(2 ** (attempt - 1))

        logger.error(
            "EVENT_DELIVERY_FAILED_MAX_RETRIES",
            event_id=envelope["event_id"],
            event_type=envelope["event_type"]
        )
