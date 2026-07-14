import asyncio
import pytest
from unittest.mock import MagicMock
import json
import uuid

# Monkeypatch create_async_engine to strip pool parameters for SQLite
import sqlalchemy.ext.asyncio as sa_asyncio
original_create_async_engine = sa_asyncio.create_async_engine

def mock_create_async_engine(url, **kwargs):
    if url.startswith("sqlite"):
        kwargs.pop("pool_size", None)
        kwargs.pop("max_overflow", None)
    return original_create_async_engine(url, **kwargs)

sa_asyncio.create_async_engine = mock_create_async_engine

# Monkeypatch PostgreSQL UUID and JSONB types for SQLite compatibility in tests
import sqlalchemy.dialects.postgresql as pg
import sqlalchemy.types as types

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

# Override settings before other imports to point to SQLite in-memory
from app.core.config import settings
settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Mock redis.asyncio.from_url
import redis.asyncio as aioredis
class MockRedis:
    def __init__(self, *args, **kwargs):
        pass
    async def ping(self):
        return True
    async def close(self):
        pass
    async def incr(self, key, *args, **kwargs):
        return 1
    async def expire(self, key, *args, **kwargs):
        return True
    async def get(self, key, *args, **kwargs):
        return None
    async def set(self, key, value, *args, **kwargs):
        return True
    async def delete(self, key, *args, **kwargs):
        return 0
    async def exists(self, key, *args, **kwargs):
        return False

aioredis.from_url = MagicMock(return_value=MockRedis())

# Now import application modules
from app.core.database import Base, get_db as db_get_db
from app.api.deps import get_db as api_get_db
from app.main import app

@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    from app.core.database import engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed roles in SQLite (matching Alembic migrations role seed)
    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(engine) as session:
        from app.models.user import Role
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
    
    yield
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# Override get_db dependency to avoid calling PostgreSQL-specific SET LOCAL
async def override_get_db(request=None):
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

app.dependency_overrides[db_get_db] = override_get_db
app.dependency_overrides[api_get_db] = override_get_db
