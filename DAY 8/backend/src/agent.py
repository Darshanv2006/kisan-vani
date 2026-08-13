import asyncio
import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone

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
from livekit.agents.voice import room_io
from livekit.plugins import (
    deepgram,
    google,
    groq,
    murf,
    openai,
    silero,
)

# Fix Windows cp1252 console encoding crashes for non-ASCII/Devanagari characters
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Optimize ONNX Runtime thread count for Silero VAD on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

# Patch SIGKILL for Windows compatibility with livekit-agents watchfiles hot-reloader
if sys.platform == "win32" and not hasattr(signal, "SIGKILL"):
    signal.SIGKILL = getattr(signal, "SIGTERM", 15)

try:
    from db import (
        create_escalation_ticket,
        forget_farmer_profile,
        get_farmer_profile,
        log_call_analytics,
        save_farmer_profile,
    )
except ImportError:
    from src.db import (
        create_escalation_ticket,
        forget_farmer_profile,
        get_farmer_profile,
        log_call_analytics,
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

    return f"""You are Kisan Vani, an expert agricultural advisor and warm voice AI for Indian farmers.

Farmer Profile Context: {farmer_context}

CROP & FERTILIZER ADVISORY:
- When a farmer asks about fertilizers or farming guidance for wheat, cotton, or any crop, provide direct, practical advisory (e.g. NPK ratios, Urea application at tillering stage, DAP, and Zinc Sulfate).
- Always give clear, helpful farming guidance directly. Never say you are unable to provide fertilizer recommendations.

STRICT LANGUAGE MATCHING RULE (CRITICAL):
- DETECT THE USER'S EXACT LANGUAGE FROM THEIR INPUT.
- IF THE USER SPEAKS IN ENGLISH (e.g. "Hello", "What is the price", "What fertilizer should I use"), YOU MUST RESPOND 100% IN CLEAN ENGLISH ONLY.
- DO NOT USE ANY DEVANAGARI SCRIPT OR HINDI WORDS IN AN ENGLISH RESPONSE. (Write state names in English script, e.g. "Karnataka", "Punjab").
- IF AND ONLY IF THE USER SPEAKS IN HINDI, RESPOND IN HINDI (Devanagari script).
- NEVER mix Hindi words or Devanagari script inside an English sentence.
- NEVER output XML tags, angle brackets ('<', '>'), math symbols, code parameter names, or slash commands like '/function=' or '<function=' in your text responses. Execute tools silently without printing raw function call syntax.

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
6. HARMFUL & NON-FARMING REQUESTS: If asked about illegal, harmful, or non-farming topics (like hacking, weapons, or cyberattacks), politely refuse: "I cannot help with that request as I am an agricultural advisor. How can I assist with your crops?"
7. End call gracefully: If the user says "bye", "goodbye", "stop", "see you", or asks to end the call, execute the end_call tool immediately to say goodbye and hang up.
8. Keep responses ultra-concise, warm, and direct (1 short sentence, 10-15 words max). Give immediate direct answers to maximize response speed."""


class Assistant(Agent):
    def __init__(self, profile: dict | None = None) -> None:
        super().__init__(instructions=build_system_prompt(profile))
        self.tools_used = []
        self.query_type = "General Advisory"

    @function_tool
    async def end_call(
        self,
        context: RunContext,
        reason: str = "User requested to end call",
    ) -> str:
        """End the call immediately when the user says bye, goodbye, stop, or requests to end the call."""
        self.tools_used.append("end_call")
        logger.info(f"Hanging up call: {reason}")

        async def _say_and_disconnect() -> None:
            try:
                if hasattr(context, "session") and context.session:
                    # Speak the goodbye message out loud to the user over the call
                    handle = context.session.say(
                        "Thank you for calling Kisan Vani. Goodbye!"
                    )
                    await handle.wait_for_playout()
                    # Disconnect room after speaking goodbye
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
        self.tools_used.append("get_weather_forecast")
        self.query_type = "Weather Forecast"
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
        DO NOT call this tool for crop protection, weather, fertilizer recommendations, or general farming advice.
        """
        self.tools_used.append("get_mandi_market_prices")
        self.query_type = "Mandi Prices"
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
        self.tools_used.append("save_farmer_memory")
        self.query_type = "Memory Save"
        if not consent_given:
            return json.dumps({"status": "declined"})

        result = await asyncio.to_thread(
            save_farmer_profile,
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
        self.tools_used.append("forget_farmer_memory")
        success = await asyncio.to_thread(forget_farmer_profile, user_id)
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
        DO NOT call this tool when answering general fertilizer, soil, or crop advisory questions.
        """
        self.tools_used.append("create_escalation")
        self.query_type = "Crop Emergency Escalation"
        if not user_consent_granted:
            return json.dumps(
                {"status": "declined", "message": "Farmer declined consent."}
            )

        import random

        ticket_num = random.randint(10000, 99999)
        ticket_id = f"KV-{ticket_num}"

        ticket = await asyncio.to_thread(
            create_escalation_ticket,
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

        await asyncio.to_thread(dispatch_human_escalation, ticket)

        return json.dumps(
            {
                "status": "created",
                "ticket_id": ticket_id,
                "next_step": f"An agricultural officer will review ticket {ticket_id} and call you back within 24 hours.",
            }
        )


server = AgentServer(
    num_idle_processes=1,
)


def prewarm(proc: JobProcess):
    vad = silero.VAD.load(
        min_speech_duration=0.1,
        min_silence_duration=0.35,
        prefix_padding_duration=0.15,
    )
    # Pre-warm Silero ONNX Runtime session to eliminate "inference is slower than realtime" initial frame delay
    try:
        import numpy as np

        sess = vad._onnx_session
        input_names = [i.name for i in sess.get_inputs()]
        dummy_in = {
            input_names[0]: np.zeros((1, 512), dtype=np.float32),
            input_names[1]: np.zeros((2, 1, 128), dtype=np.float32),
            input_names[2]: np.array(16000, dtype=np.int64),
        }
        sess.run(None, dummy_in)
    except Exception as e:
        logger.warning(f"VAD ONNX warmup notice: {e}")

    proc.userdata["vad"] = vad


server.setup_fnc = prewarm


def get_llm():
    """Smart LLM loader favoring verified Groq key to prevent 401 Unauthorized errors."""
    provider = os.getenv("LLM_PROVIDER", "").lower()

    if not provider and os.path.exists(".active_llm"):
        try:
            with open(".active_llm", encoding="utf-8") as f:
                provider = f.read().strip().lower()
        except Exception:
            pass

    # If provider is explicitly ollama, load local Ollama
    if provider == "ollama":
        logger.info("Using Local Ollama LLM (qwen2.5:3b)...")
        return openai.LLM(
            base_url="http://localhost:11434/v1",
            api_key="ollama",
            model="qwen2.5:3b",
        )

    # If Google key is present and explicitly requested, use Gemini
    google_key = os.getenv("GOOGLE_API_KEY", "")
    if provider == "gemini" and google_key.startswith("AIzaSy"):
        logger.info("Using Google Gemini LLM (gemini-1.5-flash)...")
        return google.LLM(model="gemini-1.5-flash")

    # Default to high-performance Groq LLM (llama-3.1-8b-instant)
    logger.info("Using Groq LLM (llama-3.1-8b-instant)...")
    return groq.LLM(model="llama-3.1-8b-instant")


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # 1. Connect to LiveKit Room INSTANTLY
    await ctx.connect()

    start_time = time.time()
    start_iso = datetime.now(timezone.utc).isoformat()

    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Pre-fetch farmer profile from SQLite DB in worker thread
    profile = await asyncio.to_thread(get_farmer_profile, "farmer_1")
    assistant = Assistant(profile=profile)

    # Initialize fast pipeline components per session
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="en",
        ),
        llm=get_llm(),
        tts=murf.TTS(
            voice="Anisha",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=4),
            min_buffer_size=2,
            text_pacing=True,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Shutdown hook to record call analytics into SQLite DB
    _logged = {"done": False}

    async def _save_call_log():
        if _logged["done"]:
            return
        _logged["done"] = True

        end_iso = datetime.now(timezone.utc).isoformat()
        duration = max(1, int(time.time() - start_time))
        tools = assistant.tools_used
        query_type = assistant.query_type
        room_name = getattr(ctx.room, "name", "call_session")

        # Success condition: tools executed OR duration >= 5 seconds
        if tools or duration >= 5:
            status = "SUCCESS"
            reason = "None"
        else:
            status = "FAILED"
            reason = "User Early Hangup"

        channel = "SIP" if "sip" in room_name.lower() else "Browser"

        await asyncio.to_thread(
            log_call_analytics,
            call_id=f"call_{room_name}_{int(start_time)}",
            user_id="farmer_1",
            channel=channel,
            start_time=start_iso,
            end_time=end_iso,
            duration_seconds=duration,
            status=status,
            failure_reason=reason,
            query_type=query_type,
            language="English",
            tools_used=tools,
        )
        print(f"*** CALL ANALYTICS SAVED TO SQLITE ***: Status={status}, Duration={duration}s, Query={query_type}")

    ctx.add_shutdown_callback(_save_call_log)

    if not hasattr(assistant, "_background_tasks"):
        assistant._background_tasks = set()

    @ctx.room.on("participant_disconnected")
    def _on_participant_left(p):
        t = asyncio.create_task(_save_call_log())
        assistant._background_tasks.add(t)
        t.add_done_callback(assistant._background_tasks.discard)

    @ctx.room.on("disconnected")
    def _on_room_disconnected():
        t = asyncio.create_task(_save_call_log())
        assistant._background_tasks.add(t)
        t.add_done_callback(assistant._background_tasks.discard)

    # Attach explicit diagnostic event logging for all 6 pipeline stages
    @session.on("user_state_changed")
    def _on_user_state(ev):
        logger.info(f"🎤 [DIAGNOSTIC A - SPEECH DETECTED] User state: {ev.old_state} -> {ev.new_state}")

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev):
        logger.info(f"📝 [DIAGNOSTIC B/C - STT TRANSCRIPT] Final={ev.is_final} | Text: '{ev.transcript}'")

    @session.on("agent_state_changed")
    def _on_agent_state(ev):
        logger.info(f"🤖 [DIAGNOSTIC C/D/E - AGENT STATE] {ev.old_state} -> {ev.new_state}")

    @session.on("conversation_item_added")
    def _on_item_added(ev):
        logger.info(f"💬 [DIAGNOSTIC C/D - CONVERSATION ITEM] Role={getattr(ev.item, 'role', 'unknown')}: '{getattr(ev.item, 'content', ev.item)}'")

    @session.on("speech_created")
    def _on_speech_created(ev):
        logger.info(f"🔊 [DIAGNOSTIC E/F - TTS SPEECH CREATED] Source={ev.source}")

    @session.on("error")
    def _on_session_error(ev):
        logger.error(f"❌ [DIAGNOSTIC ERROR] Session error: {ev.error}", exc_info=True)

    # 2. Start agent session setup on room (fast 0.2s pre-connect timeout for instant audio capture)
    await session.start(
        agent=assistant,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                pre_connect_audio=True,
                pre_connect_audio_timeout=0.2,
            )
        ),
    )

    @ctx.room.on("chat_message")
    def _on_chat_message(msg):
        text = msg.message.strip() if hasattr(msg, "message") else str(msg).strip()
        if text:
            logger.info(f"Received user chat message: {text}")
            t = asyncio.create_task(session.generate_reply(user_input=text))
            assistant._background_tasks.add(t)
            t.add_done_callback(assistant._background_tasks.discard)

    # 3. Trigger initial greeting
    greeting = "Hello! Welcome to Kisan Vani. How can I assist you with your crops or farm today?"
    session.say(greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    cli.run_app(server)
