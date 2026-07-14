import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect('postgresql://postgres:CDVByqTUKjxAlWjBkyOIjXTAlcAaakUf@hayabusa.proxy.rlwy.net:42919/railway')
    
    tenants = await conn.fetch("SELECT id, company_slug, company_name FROM tenants")
    print("Tenants in DB:")
    for t in tenants:
        print(f" - {t['company_slug']} ({t['company_name']})")
        
    users = await conn.fetch("SELECT email, full_name FROM users")
    print("Users in DB:")
    for u in users:
        print(f" - {u['email']} ({u['full_name']})")
        
    await conn.close()

asyncio.run(check())
