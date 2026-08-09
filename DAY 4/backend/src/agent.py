import json
import logging
import signal
import sys

# Patch SIGKILL for Windows compatibility with livekit-agents watchfiles hot-reloader
if sys.platform == "win32" and not hasattr(signal, "SIGKILL"):
    signal.SIGKILL = getattr(signal, "SIGTERM", 15)

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    room_io,
    tokenize,
)
from livekit.plugins import deepgram, groq, murf, noise_cancellation, silero

try:
    from db import forget_farmer_profile, get_farmer_profile, save_farmer_profile
except ImportError:
    from src.db import forget_farmer_profile, get_farmer_profile, save_farmer_profile

logger = logging.getLogger("agent")

load_dotenv(".env.local")


def build_system_prompt(profile: dict | None) -> str:
    if profile and profile.get("name"):
        name = profile["name"]
        crops = profile.get("crops_grown", "Cotton and Wheat")
        district = profile.get("district", "Punjab")
        farmer_context = f"RETURNING FARMER RECOGNIZED FROM SQLITE MEMORY: Name: {name}, Crops: {crops}, District: {district}."
    else:
        farmer_context = "NEW FARMER: Name and crops not yet saved in memory."

    return f"""You are Kisan Vani, an intelligent voice AI for Indian farmers with persistent memory.

FARMER MEMORY CONTEXT:
{farmer_context}

FORMATTING RULE:
Output ONLY plain spoken text. NEVER output XML tags, markdown blocks, or attribute tags.

CODE-MIXED HINDI & LANGUAGE SCRIPT:
- Understand and respond fluently in English, Hindi, and Hinglish.
- LANGUAGE & SCRIPT RULE: Always write every language in its own native script.
  - Hindi → Devanagari script (e.g. नमस्ते! Kisan Vani में आपका स्वागत है), NEVER romanized phonetics.
  - English → Standard English script.
- Always mirror the user's language and tone with warmth and respect ("जी", "अनीशा", "हाँ जी", "बिल्कुल").

DYNAMIC MEMORY & CONSENT RULES:
1. WHEN FARMER SHARES DETAILS (Name, Crops, Land, Location):
   - Answer their agricultural question first.
   - THEN ASK FOR CONSENT TO SAVE: "क्या मैं आपकी यह जानकारी (नाम और फसल) याद रखने के लिए अपनी memory में save कर लूँ?"
2. WHEN FARMER SAYS YES TO SAVING (e.g., "Yes", "Haanji", "Save kar lo"):
   - Call `save_farmer_memory` tool immediately.
   - Confirm out loud in Devanagari Hindi: "धन्यवाद! आपकी जानकारी Kisan Vani memory में सुरक्षित save हो गई है।"
3. WHEN FARMER ASKS "DO YOU REMEMBER ME?" OR "WHAT IS MY NAME / PREVIOUS DETAILS?":
   - Use the FARMER MEMORY CONTEXT to answer with exact details from the previous call!

Keep all responses short, warm, and natural (1-2 sentences)."""


class Assistant(Agent):
    def __init__(self, profile: dict | None = None) -> None:
        super().__init__(instructions=build_system_prompt(profile))

    @function_tool
    async def save_farmer_memory(
        self,
        context: RunContext,
        name: str,
        user_id: str = "farmer_1",
        consent_given: bool = True,
        crops_grown: str = "Cotton and Wheat",
        land_size: str = "4 acres",
        district: str = "Bhatinda",
        irrigation_type: str = "Drip",
        language_preference: str = "en",
    ) -> str:
        """Save farmer profile into SQLite DB."""
        if not consent_given:
            return json.dumps({"status": "declined"})

        result = save_farmer_profile(
            user_id=user_id,
            name=name,
            language_preference="en",
            crops_grown=crops_grown,
            land_size=land_size,
            district=district,
            irrigation_type=irrigation_type,
        )
        print(f"*** DB UPDATED IN SQLITE ***: {result}")
        return json.dumps(
            {
                "status": "success",
                "name": name,
            }
        )

    @function_tool
    async def forget_farmer_memory(
        self,
        context: RunContext,
        user_id: str = "farmer_1",
    ) -> str:
        """Delete farmer record from SQLite DB."""
        success = forget_farmer_profile(user_id)
        if success:
            return json.dumps({"status": "success"})
        return json.dumps({"status": "not_found"})


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.1,
        min_silence_duration=0.5,
        prefix_padding_duration=0.3,
    )


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Pre-fetch farmer profile instantly from SQLite DB to eliminate tool call roundtrips!
    profile = get_farmer_profile("farmer_1")

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="hi",
        ),
        llm=groq.LLM(
            model="llama-3.3-70b-versatile",
        ),
        tts=murf.TTS(
            voice="Anisha",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=False,
    )

    # 1. Start agent session setup on room
    await session.start(
        agent=Assistant(profile=profile),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # 2. Connect to LiveKit Room
    await ctx.connect()

    # 3. Speak initial warm welcome greeting to user immediately
    greeting = (
        "Namaste! Welcome to Kisan Vani. How can I help you with your crops today?"
    )

    await session.say(greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(server)
