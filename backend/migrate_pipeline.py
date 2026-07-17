import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = 'postgresql+asyncpg://postgres:CDVByqTUKjxAlWjBkyOIjXTAlcAaakUf@hayabusa.proxy.rlwy.net:42919/railway'

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS application_stages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
                stage_number INTEGER NOT NULL,
                stage_name VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'LOCKED',
                scheduled_at TIMESTAMPTZ,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                score FLOAT,
                max_score FLOAT DEFAULT 100.0,
                feedback TEXT,
                ai_recommendation TEXT,
                recruiter_feedback TEXT,
                metadata JSONB DEFAULT '{}',
                ai_evaluated BOOLEAN DEFAULT FALSE,
                manually_overridden BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_app_stages_app ON application_stages(application_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_app_stages_tenant ON application_stages(tenant_id);"))
    print('Done: application_stages created.')
    await engine.dispose()

asyncio.run(migrate())
