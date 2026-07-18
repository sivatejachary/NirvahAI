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

INTEGRATION_SERVICE_URL = settings.INTEGRATION_SERVICE_URL
INTEGRATION_SECRET = settings.INTEGRATION_SECRET

if not INTEGRATION_SECRET:
    if settings.is_production:
        raise ValueError(
            "INTEGRATION_SECRET environment variable MUST be configured in production!"
        )
    else:
        logger.warning("INTEGRATION_SECRET is not set. Event signatures will fail verification.")
        INTEGRATION_SECRET = "dev-secret-only-for-local-runs"


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
    Publishes events to a Redis-backed durable event queue
    and processes them asynchronously via a persistent background worker loop.
    If VidyaMarg is down, events wait in the queue and retry automatically.
    """
    _worker_task: Optional[asyncio.Task] = None

    @classmethod
    def ensure_worker_running(cls):
        if cls._worker_task is None or cls._worker_task.done():
            cls._worker_task = asyncio.create_task(cls.start_worker_loop())

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

        # Durably enqueue the event in Redis
        try:
            from app.core.redis import get_redis
            redis = get_redis()
            event_data = {
                "envelope": envelope,
                "signature": signature,
                "retry_count": 0
            }
            await redis.rpush("integration:events_queue", json.dumps(event_data))
        except Exception as e:
            logger.error(f"Failed to durably enqueue event in Redis: {e}. Falling back to in-memory dispatch.")
            asyncio.create_task(cls._deliver_event_with_retry(envelope, signature))

        # Ensure background processing loop is active
        cls.ensure_worker_running()

        return envelope

    @classmethod
    async def start_worker_loop(cls):
        logger.info("Starting integration event bus background worker loop...")
        while True:
            try:
                from app.core.redis import get_redis
                redis = get_redis()
                event_data_str = await redis.lpop("integration:events_queue")
                if event_data_str:
                    event_data = json.loads(event_data_str)
                    envelope = event_data["envelope"]
                    signature = event_data["signature"]
                    
                    delivered = await cls._deliver_event_with_retry(envelope, signature)
                    if not delivered:
                        # Re-enqueue to queue tail with exponential delay backoff to avoid hot loops
                        retry_count = event_data.get("retry_count", 0) + 1
                        if retry_count > 5:
                            logger.error("EVENT_DELIVERY_PERMANENT_FAILURE", event_id=envelope["event_id"])
                            await redis.rpush("integration:events_dlq", event_data_str)
                        else:
                            event_data["retry_count"] = retry_count
                            await asyncio.sleep(5) # Delay recheck
                            await redis.rpush("integration:events_queue", json.dumps(event_data))
                else:
                    await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Error in integration event bus worker loop: {e}")
                await asyncio.sleep(5)

    @classmethod
    async def _deliver_event_with_retry(
        cls,
        envelope: Dict[str, Any],
        signature: str,
        max_retries: int = 3
    ) -> bool:
        """
        Integration Service delivery worker:
        Performs signed HTTP POST to Integration Service / VidyaMarg event receiver.
        Returns True if successful, False on permanent failure.
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
                        return True
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

            if attempt < max_retries:
                await asyncio.sleep(2 ** (attempt - 1))

        logger.error(
            "EVENT_DELIVERY_FAILED_MAX_RETRIES",
            event_id=envelope["event_id"],
            event_type=envelope["event_type"]
        )
        return False
