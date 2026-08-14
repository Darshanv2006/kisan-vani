import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv
from livekit import api

# Load environment variables from .env.local or .env
load_dotenv(".env.local")
if not os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK_ID"):
    load_dotenv(".env")


async def main():
    parser = argparse.ArgumentParser(
        description="Make an outbound call to Linphone / SIP via LiveKit Telephony."
    )
    parser.add_argument(
        "--to",
        required=True,
        help="Linphone username (e.g. 'john' or 'sip:john@sip.linphone.org')",
    )
    parser.add_argument(
        "--trunk",
        required=False,
        default=os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK_ID"),
        help="LiveKit Outbound SIP Trunk ID (ST_xxx)",
    )
    args = parser.parse_args()

    trunk_id = args.trunk
    if not trunk_id:
        print(
            "❌ Error: LIVEKIT_SIP_OUTBOUND_TRUNK_ID environment variable or --trunk flag is missing!"
        )
        print(
            "Please set LIVEKIT_SIP_OUTBOUND_TRUNK_ID in backend/.env.local or pass --trunk ST_xxxx"
        )
        sys.exit(1)

    target_user = args.to.strip()
    # LiveKit SIP outbound trunks expect the target username or phone number (e.g. 'shivu'), not a full SIP URI.
    sip_address = target_user.replace("sip:", "").split("@")[0]

    import time

    room_name = f"kisan-vani-outbound-{sip_address}-{int(time.time())}"

    print("Initiating Outbound Call...")
    print(f"   Target User/Phone  : {sip_address}")
    print(f"   LiveKit Room Name  : {room_name}")
    print(f"   Trunk ID           : {trunk_id}")

    lkapi = api.LiveKitAPI()

    try:
        # 1. Explicitly dispatch the voice agent to the outbound call room
        print(f"Dispatching agent 'my-agent' to room '{room_name}'...")
        try:
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    room=room_name,
                    agent_name="my-agent",
                )
            )
            print(f"Agent dispatched successfully! Dispatch ID: {dispatch.id}")
        except Exception as de:
            print(f"Agent dispatch notice: {de}")

        # 2. Initiate the SIP call
        req = api.CreateSIPParticipantRequest(
            sip_trunk_id=trunk_id,
            sip_call_to=sip_address,
            sip_number=sip_address,
            room_name=room_name,
            participant_identity=f"farmer-{sip_address}",
            participant_name="Farmer (Linphone)",
        )
        participant = await lkapi.sip.create_sip_participant(req)
        print("Call Initiated Successfully!")
        print(f"   SIP Call ID : {participant.sip_call_id}")
        print(f"   Participant : {participant.participant_identity}")
        print("Your Linphone app should start ringing now!")
    except Exception as e:
        print(f"Failed to initiate SIP call: {e}")
    finally:
        await lkapi.aclose()


if __name__ == "__main__":
    asyncio.run(main())
