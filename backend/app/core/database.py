"""
Database Engine, Session, and Connection Pool Management
Async PostgreSQL using SQLAlchemy 2.0 + asyncpg
"""
from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

# ── SQLite Compatibility Monkeypatches ────────────────────────────────────────
if "sqlite" in settings.DATABASE_URL:
    import sqlalchemy.dialects.postgresql as pg
    import sqlalchemy.types as types
    import uuid
    import json

    class SQLiteUUID(types.TypeDecorator):
        impl = types.String
        cache_ok = True

        def __init__(self, *args, **kwargs):
            kwargs.pop("as_uuid", None)
            super().__init__(*args, **kwargs)

        def process_bind_param(self, value, dialect):
            if value is None:
                return value
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)

        def process_result_value(self, value, dialect):
            if value is None:
                return value
            try:
                return uuid.UUID(value)
            except ValueError:
                return value

    class SQLiteJSONB(types.TypeDecorator):
        impl = types.Text
        cache_ok = True

        def process_bind_param(self, value, dialect):
            if value is None:
                return value
            return json.dumps(value)

        def process_result_value(self, value, dialect):
            if value is None:
                return value
            return json.loads(value)

    pg.UUID = SQLiteUUID
    pg.JSONB = SQLiteJSONB


logger = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Declarative Base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Verify database connectivity on startup."""
    if "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Seed system roles
        from app.models.user import Role
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            role_stmt = select(Role).limit(1)
            existing_role = (await session.execute(role_stmt)).scalar_one_or_none()
            if not existing_role:
                roles = [
                    Role(name="platform_admin", display_name="Platform Administrator", is_system_role=True),
                    Role(name="tenant_admin", display_name="Company Administrator", is_system_role=True),
                    Role(name="hr_manager", display_name="HR Manager", is_system_role=True),
                    Role(name="hr_recruiter", display_name="Recruiter", is_system_role=True),
                    Role(name="hiring_manager", display_name="Hiring Manager", is_system_role=True),
                    Role(name="interviewer", display_name="Interviewer", is_system_role=True),
                    Role(name="employee", display_name="Employee", is_system_role=True),
                ]
                session.add_all(roles)
                await session.commit()
    else:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.execute(text("SELECT 1"))
        except Exception as e:
            logger.warning(f"DB init non-fatal warning: {e}")
    logger.info("Database connection verified")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a database session.
    Tenant context variable must be set BEFORE yielding by TenantContextMiddleware.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_with_tenant(
    tenant_id: str,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a session with the tenant context variable set for Row-Level Security.
    The local variable `app.current_tenant_id` activates RLS policies.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Set the tenant context for PostgreSQL RLS policies
            if "sqlite" not in str(session.bind.url):
                await session.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(tenant_id)},
                )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
