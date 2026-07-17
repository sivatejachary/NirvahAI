import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql+asyncpg://postgres:CDVByqTUKjxAlWjBkyOIjXTAlcAaakUf@hayabusa.proxy.rlwy.net:42919/railway'
)
if DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE company_settings 
            ADD COLUMN IF NOT EXISTS recruitment_workflow JSONB DEFAULT '{}';
        """))
    print('Migration complete: recruitment_workflow column added to company_settings.')
    await engine.dispose()

asyncio.run(migrate())
