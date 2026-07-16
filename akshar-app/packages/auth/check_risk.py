import asyncio
from app.db.couch_client import db

async def main():
    await db.connect()
    users = await db.find({"type": "user"})
    for u in users:
        uid = u["userId"]
        trust = await db.get(f"trust:{uid}")
        if trust:
            tier2b = trust.get("tier2b", {})
            print(f"User {uid}: riskHold={tier2b.get('riskHold')} livenessPassed={tier2b.get('lastLivenessPassed')} score={trust.get('history', [-1])[-1]}")
    await db.close()

asyncio.run(main())
