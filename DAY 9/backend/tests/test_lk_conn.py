import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv(".env.local")


async def main():
    lk = api.LiveKitAPI()
    try:
        rooms = await lk.room.list_rooms(api.ListRoomsRequest())
        print(
            f"LiveKit Cloud Connected Successfully! Active rooms count: {len(rooms.rooms)}"
        )
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
