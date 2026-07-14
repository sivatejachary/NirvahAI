"""
Structured Logging Configuration
Uses structlog for JSON-formatted, machine-readable log output.
"""
import logging
import sys

import structlog
from structlog.types import FilteringBoundLogger

from app.core.config import settings


def setup_logging() -> None:
    """Configure structlog for the application."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_production:
        # JSON output for production / log aggregators
        shared_processors.append(structlog.processors.dict_tracebacks)
        renderer = structlog.processors.JSONRenderer()
    else:
        # Human-readable console output for development
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)

    # Suppress noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if settings.APP_DEBUG else logging.WARNING
    )


def get_logger(name: str) -> FilteringBoundLogger:
    return structlog.get_logger(name)
