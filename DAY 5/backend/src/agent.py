import json
import logging
import os
import signal
import sys

# Optimize ONNX Runtime thread count for Silero VAD on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

# Patch SIGKILL for Windows compatibility with livekit-agents watchfiles hot-reloader
if sys.platform == "win32" and not hasattr(signal, "SIGKILL"):
    signal.SIGKILL = getattr(signal, "SIGTERM", 15)

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    tokenize,
)
from livekit.plugins import (
    deepgram,
    groq,
    murf,
    silero,
)

try:
    from db import forget_farmer_profile, get_farmer_profile, save_farmer_profile
except ImportError:
    from src.db import forget_farmer_profile, get_farmer_profile, save_farmer_profile

try:
    from tools import fetch_mandi_prices, fetch_weather_forecast
except ImportError:
    from src.tools import fetch_mandi_prices, fetch_weather_forecast

logger = logging.getLogger("agent")

load_dotenv(".env.local")


def build_system_prompt(profile: dict | None) -> str:
    if profile and profile.get("name"):
        name = profile["name"]
        crops = profile.get("crops_grown", "Cotton and Wheat")
        district = profile.get("district", "Bhatinda")
        farmer_context = f"Recognized returning farmer: Name: {name}, Crops: {crops}, District: {district}."
    else:
        farmer_context = "New farmer: Name and crops not yet saved in memory."

    return f"""You are Kisan Vani, a warm, helpful voice AI for Indian farmers.

Farmer Profile Context: {farmer_context}

RULES:
1. LANGUAGE: Match exact user language (English -> English, Hindi/Hinglish -> Hindi Devanagari).
2. SILENT TOOLS: Call tools immediately and silently. NEVER emit filler like "checking database", "looking up weather", or raw function syntax.
3. NO JARGON: Never mention technical terms like "database", "API", "tool", "system", or "record".
4. MANDI PRICES: Never say prices are "live". Always say: "According to the curated mandi benchmark data dated [as_of_date]..."
5. WEATHER: Fetch weather silently and speak the forecast out loud.
6. MEMORY CONSENT: When user shares personal details, answer first, then ask consent: "क्या मैं आपकी यह जानकारी memory में save कर लूँ?". When they agree, execute save tool. Use Farmer Profile Context to answer recall queries.
7. Keep responses ultra-concise, warm, and direct (1 short sentence, max 15 words)."""


class Assistant(Agent):
    def __init__(self, profile: dict | None = None) -> None:
        super().__init__(instructions=build_system_prompt(profile))

    @function_tool
    async def get_weather_forecast(
        self,
        context: RunContext,
        district: str = "Bhatinda",
    ) -> str:
        """
        Fetch real-time live weather forecast for a given district in India.
        Use this when farmers ask about weather, rain, temperature, or climate forecast.
        """
        return await fetch_weather_forecast(district)

    @function_tool
    async def get_mandi_market_prices(
        self,
        context: RunContext,
        crop_name: str = "Cotton",
        district: str = "Bhatinda",
    ) -> str:
        """
        Fetch current Mandi (APMC) market prices for a crop and district.
        Use this when farmers ask for crop prices, mandi rates, or market rates.
        """
        return await fetch_mandi_prices(crop_name, district)

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


server = AgentServer(
    num_idle_processes=1,
)


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.05,
        min_silence_duration=0.25,
        prefix_padding_duration=0.1,
    )


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # 1. Connect to LiveKit Room INSTANTLY
    await ctx.connect()

    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Pre-fetch farmer profile from SQLite DB
    profile = get_farmer_profile("farmer_1")

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi",
        ),
        llm=groq.LLM(
            model="llama-3.1-8b-instant",
        ),
        tts=murf.TTS(
            voice="Anisha",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=5),
            text_pacing=False,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # 2. Start agent session setup on room
    await session.start(
        agent=Assistant(profile=profile),
        room=ctx.room,
    )

    # 3. Trigger initial welcome greeting (session.say returns SpeechHandle non-blocking)
    greeting = "Namaste! Welcome to Kisan Vani. How can I help you with your crops, market prices, or weather forecast today?"
    session.say(greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(server)
