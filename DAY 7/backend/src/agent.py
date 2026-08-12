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
    google,
    groq,
    murf,
    openai,
    silero,
)

try:
    from db import (
        create_escalation_ticket,
        forget_farmer_profile,
        get_farmer_profile,
        save_farmer_profile,
    )
except ImportError:
    from src.db import (
        create_escalation_ticket,
        forget_farmer_profile,
        get_farmer_profile,
        save_farmer_profile,
    )

try:
    from tools import (
        dispatch_human_escalation,
        fetch_mandi_prices,
        fetch_weather_forecast,
    )
except ImportError:
    from src.tools import (
        dispatch_human_escalation,
        fetch_mandi_prices,
        fetch_weather_forecast,
    )

logger = logging.getLogger("agent")

load_dotenv(".env.local")


def build_system_prompt(profile: dict | None) -> str:
    if profile and profile.get("name"):
        name = profile["name"]
        crops = profile.get("crops_grown", "Cotton and Wheat")
        district = profile.get("district", "Bhatinda")
        farmer_context = f"Recognized returning farmer: Name: {name}, Crops: {crops}, District: {district}."
    else:
        farmer_context = (
            "Farmer: Name: Shivu, Crops: Cotton & Wheat, District: Bhatinda."
        )

    return f"""You are Kisan Vani, a warm, helpful voice AI for Indian farmers.

Farmer Profile Context: {farmer_context}

STRICT LANGUAGE MATCHING RULE (CRITICAL):
- DETECT THE USER'S EXACT LANGUAGE FROM THEIR INPUT.
- IF THE USER SPEAKS IN ENGLISH (e.g. "Hello", "What is the price", "Can you help me"), YOU MUST RESPOND 100% IN CLEAN ENGLISH ONLY. DO NOT USE ANY HINDI WORDS OR DEVANAGARI SCRIPT.
- IF AND ONLY IF THE USER SPEAKS IN HINDI, RESPOND IN HINDI.
- DEFAULT TO ENGLISH FOR ALL ENGLISH USER INPUTS.
- NEVER mix Hindi words or Devanagari script inside an English sentence.
- NEVER output XML tags, angle brackets ('<', '>'), math symbols, or code parameter names in your text.

WHEN TO ASK FOR HUMAN HELP (HUMAN ESCALATION):
You MUST offer to connect the farmer to a human specialist in 2 specific situations:
1. Serious Crop Emergency: Uncontrolled pest attack (e.g. pink bollworm in cotton), severe disease, dying crops, or major crop damage requiring human expert advice.
2. Missing Data or Complex Queries: Market prices/weather data unavailable, or farmer asks for complex government subsidy applications, loan claims, or financial advice beyond AI tools.

MANDATORY CONSENT STEP BEFORE ESCALATION:
- When human help is required, FIRST ask explicit consent before creating a request:
  "I recommend connecting you with our human agricultural specialist. May I share your name, district, and crop issue summary with our expert team?"
- IF THE FARMER AGREES ("yes", "sure", "okay", "please do"): Call the `create_escalation` tool immediately.
- IF THE FARMER DECLINES ("no", "don't share"): Do NOT call `create_escalation`. Say "Understood, I will keep your details private. How else can I assist you?"

AFTER CREATING ESCALATION TICKET:
- The tool returns a ticket reference ID (e.g., KV-84920).
- Speak the reference ID clearly and explain next steps:
  "I have logged escalation ticket KV-XXXX. An agricultural officer will review your crop issue and call you back within 24 hours."

CORE RULES:
1. SILENT TOOLS: Call tools immediately and silently. NEVER speak tool parameters or filler code.
2. NO JARGON: Keep language simple and human.
3. MANDI PRICES: Never say prices are "live". Always say: "According to the curated mandi benchmark data dated [as_of_date]..."
4. WEATHER: Fetch weather silently and speak forecast out loud clearly.
5. MEMORY CONSENT: When user shares personal details, answer first, then ask consent: "May I save this information for your farmer profile?". When agreed, execute save tool.
6. End call gracefully: If the user says "stop", "bye", or "end call", execute the end_call tool to hang up.
7. Keep responses concise, warm, and direct (1-2 sentences)."""


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
                    handle = context.session.say(
                        "Understood. The alert call has been stopped. Goodbye!"
                    )
                    await handle.wait_for_playout()
                    # Disconnect after speaking
                    if hasattr(context.session, "room_io") and context.session.room_io:
                        await context.session.room_io.room.disconnect()
            except Exception as e:
                logger.error(f"Error in end_call disconnect flow: {e}")

        task = asyncio.create_task(_say_and_disconnect())
        if not hasattr(self, "_background_tasks"):
            self._background_tasks = set()
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
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

    @function_tool
    async def create_escalation(
        self,
        context: RunContext,
        caller_name: str = "Shivu",
        district: str = "Bhatinda",
        issue_category: str = "Crop Disease Emergency",
        urgency: str = "HIGH",
        issue_summary: str = "Farmer reported severe pink bollworm infestation damaging cotton crop.",
        agent_checked: str = "Checked weather forecast and mandi prices; pest infestation requires specialist intervention.",
        user_consent_granted: bool = True,
    ) -> str:
        """
        Create a human escalation request for crop emergency or missing/complex data.
        MUST ONLY BE CALLED AFTER THE FARMER GRANTS EXPLICIT CONSENT.
        """
        if not user_consent_granted:
            return json.dumps(
                {"status": "declined", "message": "Farmer declined consent."}
            )

        import random

        ticket_num = random.randint(10000, 99999)
        ticket_id = f"KV-{ticket_num}"

        ticket = create_escalation_ticket(
            ticket_id=ticket_id,
            user_id="farmer_1",
            caller_name=caller_name,
            contact_number="+91 98765 43210",
            district=district,
            issue_category=issue_category,
            urgency=urgency,
            issue_summary=issue_summary,
            agent_checked=agent_checked,
            user_consent_granted=user_consent_granted,
        )

        dispatch_human_escalation(ticket)

        return json.dumps(
            {
                "status": "created",
                "ticket_id": ticket_id,
                "next_step": f"An agricultural officer will review ticket {ticket_id} and call you back within 24 hours.",
            }
        )


server = AgentServer(
    num_idle_processes=3,
)


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.05,
        min_silence_duration=0.25,
        prefix_padding_duration=0.1,
    )


server.setup_fnc = prewarm


def get_llm():
    """Smart LLM loader supporting Ollama, Gemini, and Groq."""
    provider = os.getenv("LLM_PROVIDER", "").lower()

    if not provider and os.path.exists(".active_llm"):
        try:
            with open(".active_llm", encoding="utf-8") as f:
                provider = f.read().strip().lower()
        except Exception:
            pass

    if provider == "groq":
        logger.info("Using Groq LLM (llama-3.1-8b-instant)...")
        return groq.LLM(model="llama-3.1-8b-instant")
    elif provider == "ollama":
        logger.info("Using Local Ollama LLM (qwen2.5:3b)...")
        return openai.LLM(
            base_url="http://localhost:11434/v1",
            api_key="ollama",
            model="qwen2.5:3b",
        )
    else:
        logger.info("Using Google Gemini LLM (gemini-2.5-flash-lite)...")
        return google.LLM(model="gemini-2.5-flash-lite")


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
        llm=get_llm(),
        tts=murf.TTS(
            voice="Anisha",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            min_buffer_size=1,
            text_pacing=True,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=False,
    )

    # 2. Start agent session setup on room
    await session.start(
        agent=Assistant(profile=profile),
        room=ctx.room,
    )

    # 3. Trigger initial Day 7 greeting
    greeting = "Hello! Welcome to Kisan Vani. How can I assist you with your crops or farm today?"
    session.say(greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(server)
