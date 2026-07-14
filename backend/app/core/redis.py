"""
Redis Connection Pool
Used for: caching, distributed locks, rate limiting, short-lived state.
Key format: tenant:{tenant_id}:{entity}:{id}
"""
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis_client: Optional[aioredis.Redis] = None


class MockRedis:
    def __init__(self, *args, **kwargs):
        self._data = {}

    async def ping(self):
        return True

    async def close(self):
        pass

    async def incr(self, key, *args, **kwargs):
        val = int(self._data.get(key, 0)) + 1
        self._data[key] = str(val)
        return val

    async def expire(self, key, *args, **kwargs):
        return True

    async def get(self, key, *args, **kwargs):
        return self._data.get(key)

    async def set(self, key, value, *args, **kwargs):
        self._data[key] = str(value)
        return True

    async def delete(self, key, *args, **kwargs):
        if key in self._data:
            del self._data[key]
            return 1
        return 0

    async def exists(self, key, *args, **kwargs):
        return key in self._data


async def init_redis() -> None:
    global _redis_client
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
        # Verify connection
        await _redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis ({e}). Falling back to MockRedis in-memory.")
        _redis_client = MockRedis()


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis_client


class TenantRedis:
    """
    Tenant-scoped Redis operations.
    All keys are automatically prefixed with tenant:{tenant_id}:
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self._redis = get_redis()

    def _key(self, *parts: str) -> str:
        return f"tenant:{self.tenant_id}:" + ":".join(parts)

    async def get(self, *key_parts: str) -> Optional[str]:
        return await self._redis.get(self._key(*key_parts))

    async def set(self, *key_parts_and_value, ex: Optional[int] = None) -> None:
        *key_parts, value = key_parts_and_value
        await self._redis.set(self._key(*key_parts), value, ex=ex)

    async def delete(self, *key_parts: str) -> int:
        return await self._redis.delete(self._key(*key_parts))

    async def exists(self, *key_parts: str) -> bool:
        return bool(await self._redis.exists(self._key(*key_parts)))

    async def acquire_lock(self, resource: str, timeout: int = 30) -> bool:
        """Distributed lock using SET NX EX."""
        key = self._key("lock", resource)
        result = await self._redis.set(key, "1", nx=True, ex=timeout)
        return result is not None

    async def release_lock(self, resource: str) -> None:
        key = self._key("lock", resource)
        await self._redis.delete(key)

    async def increment_rate_counter(self, bucket: str, window_seconds: int = 60) -> int:
        key = self._key("rate", bucket)
        count = await self._redis.incr(key)
        if count == 1:
            await self._redis.expire(key, window_seconds)
        return count
