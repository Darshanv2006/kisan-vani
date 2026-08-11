import asyncio
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
        farmer_context = "Farmer: Name: Farmer, Crops: Cotton & Wheat, District: Bhatinda."

    return f"""You are Kisan Vani, a warm, helpful voice AI for Indian farmers.

Farmer Profile Context: {farmer_context}

LANGUAGE & SCRIPT (COMPULSORY):
- Always respond in clear, natural English.
- NEVER output XML tags, angle brackets ('<', '>'), math symbols, or parameter names in your text.

OUTBOUND CALL BEHAVIOR & RULES:
1. In the first 2 sentences of an outbound call, state:
   - WHO is calling ("Hello, I am calling from Kisan Vani.")
   - WHY ("Heavy rain is forecasted for your cotton crop in Bhatinda.")
   - HOW TO STOP ("To stop these alerts or end the call, say 'stop'.")
2. SILENT TOOLS: Call tools immediately and silently. NEVER emit filler, code, or XML tags.
3. NO JARGON: Never mention technical terms, code, or parameter names.
4. MANDI PRICES: Never say prices are "live". Always say: "According to the curated mandi benchmark data dated [as_of_date]..."
5. WEATHER: Fetch weather silently and speak the forecast out loud in clear English.
6. MEMORY CONSENT: When user shares personal details, answer first, then ask consent: "May I save this information for your farmer profile?". When they agree, execute save tool.
7. End call gracefully: If the user says "stop", "end call", "bye", or asks to stop alerts, you MUST IMMEDIATELY execute the end_call tool to hang up.
8. Keep responses ultra-concise, warm, and direct (1 short sentence, max 15 words).
9. NO ANGLE BRACKETS OR CODE (< >): Speak ONLY plain human spoken English words.
10. CROP PROTECTION & ADVICE: When asked how to protect crops from heavy rain or pests, provide immediate practical advice (e.g., ensure field drainage, delay fertilizer/pesticide spraying, cover harvested yield). DO NOT call mandi price tools for protection questions!"""


class Assistant(Agent):
    def __init__(self, profile: dict | None = None) -> None:
        super().__init__(instructions=build_system_prompt(profile))

    @function_tool
    async def end_call(
        self,
        context: RunContext,
        reason: str = "User requested to end call",
    ) -> str:
        """End the call when the user requests to stop or end the call."""
        logger.info(f"Hanging up call: {reason}")

        async def _say_and_disconnect() -> None:
            try:
                if hasattr(context, "session") and context.session:
                    # Speak the goodbye message out loud to the user over the call
                    handle = context.session.say("Understood. The alert call has been stopped. Goodbye!")
                    await handle.wait_for_playout()
                    # Disconnect after speaking
                    if hasattr(context.session, "room_io") and context.session.room_io:
                        await context.session.room_io.room.disconnect()
            except Exception as e:
                logger.error(f"Error in end_call disconnect flow: {e}")

        asyncio.create_task(_say_and_disconnect())
        return "Call ended."

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
        ONLY use this tool when the user EXPLICITLY asks for prices, rates, mandi prices, or market rates.
        DO NOT call this tool for crop protection, weather, or general farming advice questions.
        """
        return await fetch_mandi_prices(crop_name, district)

    @function_tool
    async def save_farmer_memory(
        self,
        context: RunContext,
        name: str = "Shivu",
        crops_grown: str = "Cotton and Wheat",
        district: str = "Bhatinda",
        consent_given: bool = True,
    ) -> str:
        """Save farmer profile information into SQLite DB when consent is given."""
        if not consent_given:
            return json.dumps({"status": "declined"})

        result = save_farmer_profile(
            user_id="farmer_1",
            name=name,
            language_preference="en",
            crops_grown=crops_grown,
            land_size="4 acres",
            district=district,
            irrigation_type="Drip",
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
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            min_buffer_size=1,
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

    # 3. Wait for the SIP caller to answer the phone call before speaking
    logger.info("Waiting for SIP participant to answer call...")
    await ctx.wait_for_participant()
    logger.info("SIP participant joined room! Speaking outbound alert greeting...")

    # 4. Trigger initial outbound call alert greeting in clear English
    outbound_greeting = (
        "Hello! I am calling from Kisan Vani. "
        "Heavy rain is forecasted for your cotton crop in Bhatinda. "
        "To stop these alert calls, simply say 'stop'. How can I assist you today?"
    )
    session.say(outbound_greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(server)
