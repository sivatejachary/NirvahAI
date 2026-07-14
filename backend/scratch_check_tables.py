import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect('postgresql://postgres:CDVByqTUKjxAlWjBkyOIjXTAlcAaakUf@hayabusa.proxy.rlwy.net:42919/railway')
    rows = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    print("Tables:")
    for r in rows:
        print(f" - {r['table_name']}")
    await conn.close()

asyncio.run(check())
