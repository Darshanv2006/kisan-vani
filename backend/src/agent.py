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
    farmer_context = (
        f"Farmer Shivu (Crops: {profile.get('crops_grown', 'Cotton & Wheat')}, District: {profile.get('district', 'Bhatinda')})"
        if profile
        else "Farmer Shivu (Cotton & Wheat, Bhatinda)"
    )

    return f"""You are Kisan Vani, a helpful voice agent for Indian farmers. {farmer_context}.

SPECIALIST HANDOFF:
- For active crop diseases, pest infestations, leaf yellowing, black spots, or insects: Call the hand_off_to_crop_specialist tool. Say "I'll connect you with our crop problem specialist."

TOOL SELECTION:
- For Mandi rates/prices: Call the get_mandi_market_prices tool.
- For Weather/Rain forecasts: Call the get_weather_forecast tool.
- For General Farming & Agronomy (irrigation schedule, watering frequency, sowing, fertilizer advice): DO NOT call any tool. Answer directly with practical advice.

HUMAN ESCALATION:
- ONLY ask "May I connect you with a human specialist?" if there is an unresolvable emergency or missing data. Never call create_escalation unless user explicitly requests it.

RULES:
1. Speak in clean simple English unless user speaks Hindi. No Devanagari or Hindi in English responses.
2. ALWAYS use native tool calls. NEVER write tool names, XML tags, or JSON payloads into text responses.
3. NEVER use mathematical symbols (<, >, <=, >=, =) in spoken output. Use natural words like "below", "above", "around", or "about" (e.g., say "below 30%" instead of "< 30%").
4. For Goodbye ("bye/stop"): Call the end_call tool to say goodbye and hang up.
5. Keep answers ultra-concise (1-2 sentences, max 15 words)."""


class Assistant(Agent):
    def __init__(self, profile: dict | None = None) -> None:
        super().__init__(instructions=build_system_prompt(profile))
        self.profile = profile
        self.tools_used = []
        self.query_type = "General Advisory"

    @function_tool
    async def hand_off_to_crop_specialist(
        self,
        context: RunContext,
        issue_summary: str = "Crop disease, leaf spots, or pest issue reported by farmer",
    ) -> str:
        """
        Hand off the call to the specialized Crop Problem Specialist agent.
        Use this tool when the user asks specific, complex, or emergency questions about crop diseases, pest infestations, yellowing leaves, black spots, small insects, pest control, or plant health diagnosis.
        ALWAYS pass a detailed `issue_summary` capturing the exact crop name, symptoms (e.g. black spots, yellowing), and affected plant parts reported by the user.
        """
        self.tools_used.append("hand_off_to_crop_specialist")
        self.query_type = "Crop Specialist Handoff"
        logger.info(f"Handoff triggered with issue: {issue_summary}")

        specialist = CropSpecialist(profile=self.profile, issue_summary=issue_summary)
        if hasattr(context, "session") and context.session:
            context.session.update_agent(specialist)

        # Clean dynamic issue text for presentation
        clean_issue = (
            issue_summary.split(", district:")[0]
            .split(", crops:")[0]
            .split(", grower:")[0]
            .strip()
        )
        if not clean_issue.lower().startswith("user has"):
            display_summary = f"User has {clean_issue}"
        else:
            display_summary = clean_issue

        return (
            f"I'll connect you with our crop problem specialist to help with that. "
            f"I'll pass along the issue summary: {display_summary}. "
            f"Thank you for waiting. Your call will now be transferred to the crop problem specialist. Please hold for a few seconds."
        )

    @function_tool
    async def end_call(
        self,
        context: RunContext,
        reason: str = "User requested to end call",
    ) -> str:
        """
        End the call when the user explicitly says goodbye, bye, stop the call, or requests to hang up.
        DO NOT call this tool for short words, pauses, or single words like 'my', 'how', 'what', or 'hi'.
        """
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
        ONLY call this tool if the farmer explicitly asks for weather, rain forecast, temperature, or climate.
        DO NOT call this tool for general crop advice, irrigation questions, or farming tips.
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
        Fetch benchmark mandi market price data for crops in a given district in India.
        ONLY call this tool if the farmer explicitly asks for market prices, mandi rates, or crop sale prices.
        DO NOT call this tool for general crop advice, irrigation questions, or farming tips.
        """
        self.tools_used.append("get_mandi_market_prices")
        self.query_type = "Mandi Market Prices"
        return await fetch_mandi_prices(crop_name, district)

    @function_tool
    async def create_escalation(
        self,
        context: RunContext,
        caller_name: str = "Shivu",
        district: str = "Bhatinda",
        issue_category: str = "Crop Advisory / General",
        urgency: str = "MEDIUM",
        issue_summary: str = "Farmer requested human specialist consultation.",
        agent_checked: str = "AI verified profile and logged request after farmer consent.",
        user_consent_granted: bool = True,
    ) -> str:
        """
        Create a official human escalation ticket for expert callback.
        MUST ONLY be called AFTER obtaining explicit user consent ("yes", "sure", "okay").
        """
        self.tools_used.append("create_escalation")
        self.query_type = "Human Escalation Request"
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
                "status": "success",
                "ticket_id": ticket_id,
                "message": f"Escalation ticket {ticket_id} created successfully. An agricultural officer will call back within 24 hours.",
            }
        )

    @function_tool
    async def save_farmer_memory(
        self,
        context: RunContext,
        name: str = "Shivu",
        crops_grown: str = "Cotton and Wheat",
        district: str = "Bhatinda",
        consent_given: bool = False,
    ) -> str:
        """
        Save farmer profile information into SQLite DB.
        ONLY call this tool if the farmer explicitly requests to update, remember, or save their profile information.
        DO NOT call this tool for general farming questions, weather queries, mandi rates, or crop disease questions.
        """
        self.tools_used.append("save_farmer_memory")
        self.query_type = "Memory Save"
        if not consent_given:
            return json.dumps({"status": "declined", "message": "Consent not granted"})

        await asyncio.to_thread(
            save_farmer_profile,
            user_id="farmer_1",
            name=name,
            language_preference="en",
            crops_grown=crops_grown,
            land_size="4 acres",
            district=district,
            irrigation_type="Drip",
        )
        return json.dumps({"status": "success", "name": name})

    @function_tool
    async def forget_farmer_memory(
        self,
        context: RunContext,
        user_id: str = "farmer_1",
    ) -> str:
        """
        Delete farmer record from SQLite DB.
        ONLY call this tool if the farmer explicitly asks to delete, clear, or forget their stored profile or data.
        DO NOT call this tool during normal conversation, irrigation queries, or advisory questions.
        """
        self.tools_used.append("forget_farmer_memory")
        success = await asyncio.to_thread(forget_farmer_profile, user_id)
        if success:
            return json.dumps({"status": "success"})
        return json.dumps({"status": "not_found"})


def build_crop_specialist_prompt(profile: dict | None, issue_summary: str = "") -> str:
    district = profile.get("district", "Bhatinda") if profile else "Bhatinda"
    farmer_context = f"Farmer Shivu (District: {district})"

    clean_summary = (
        issue_summary.split(", district:")[0]
        .split(", crops:")[0]
        .split(", grower:")[0]
        .strip()
    )
    clean_summary = (
        clean_summary.replace("User has ", "").replace("User reported ", "").rstrip(".")
    )
    if not clean_summary:
        clean_summary = "crop disease or pest infestation"

    return f"""You are the Kisan Vani Crop & Pest Specialist. {farmer_context}.
CURRENT REPORTED CROP ISSUE: {clean_summary}

ROLE & INSTRUCTIONS:
1. When user speaks to you after transfer (e.g., says 'Okay', 'What should I do?', or asks for remedies), ALWAYS start your response with: "Namaste! I'm the Kisan Vani Crop Problem Specialist. I understand your {clean_summary}. Let's identify the possible cause and what you can do next."
2. Immediately follow with actionable, practical diagnosis and treatment advice (e.g. Copper Oxychloride 50% WP fungicide spray at 2-3 grams per liter, Neem oil spray, or proper field drainage).
3. Focus EXCLUSIVELY on the current reported crop and symptoms ({clean_summary}). Do NOT mention unrelated crops.
4. Do NOT ask the farmer to repeat their crop or symptoms.
5. NEVER output XML tags, JSON payloads, or mathematical symbols (<, >, <=, >=, =). Keep answers conversational and clear (2-3 sentences)."""


class CropSpecialist(Agent):
    def __init__(self, profile: dict | None = None, issue_summary: str = "") -> None:
        super().__init__(
            instructions=build_crop_specialist_prompt(profile, issue_summary)
        )
        self.profile = profile
        self.issue_summary = issue_summary
        self.tools_used = []
        self.query_type = "Crop Specialist Advisory"

    @function_tool
    async def hand_back_to_main_agent(
        self,
        context: RunContext,
        reason: str = "User asked for general advice, weather, or mandi prices",
    ) -> str:
        """
        Hand the conversation back to the main Kisan Vani advisor agent when crop diagnosis is complete or user asks about general topics like weather or mandi market prices.
        """
        self.tools_used.append("hand_back_to_main_agent")
        logger.info(f"Handing back to main agent: {reason}")
        main_agent = Assistant(profile=self.profile)
        if hasattr(context, "session") and context.session:
            context.session.update_agent(main_agent)
        return "Transferring you back to our main advisor."

    @function_tool
    async def create_escalation(
        self,
        context: RunContext,
        caller_name: str = "Shivu",
        district: str = "Bhatinda",
        issue_category: str = "Crop Disease Emergency",
        urgency: str = "HIGH",
        issue_summary: str = "Farmer reported severe crop damage requiring expert field visit.",
        agent_checked: str = "Specialist recommended initial spray; escalation logged for field officer visit.",
        user_consent_granted: bool = False,
    ) -> str:
        """
        Create escalation ticket for severe crop emergency requiring human field inspection.
        ONLY call this tool if the farmer has EXPLICITLY agreed or requested to connect with a human specialist or field officer.
        DO NOT call this tool during standard crop disease diagnosis or fungicide advice.
        """
        self.tools_used.append("create_escalation")
        self.query_type = "Crop Emergency Escalation"
        if not user_consent_granted:
            return json.dumps(
                {"status": "declined", "message": "Farmer consent not granted."}
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
                "next_step": f"Field officer review ticket {ticket_id} logged.",
            }
        )


server = AgentServer(
    num_idle_processes=1,
)


def prewarm(proc: JobProcess):
    vad = silero.VAD.load(
        min_speech_duration=0.1,
        min_silence_duration=0.25,
        prefix_padding_duration=0.1,
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
    """Smart LLM loader prioritizing ultra-fast response time."""
    provider = os.getenv("LLM_PROVIDER", "").lower()

    if not provider and os.path.exists(".active_llm"):
        try:
            with open(".active_llm", encoding="utf-8") as f:
                provider = f.read().strip().lower()
        except Exception:
            pass

    # If provider is explicitly openrouter, load OpenRouter
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if provider == "openrouter" and openrouter_key:
        model_name = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
        logger.info(f"Using OpenRouter LLM ({model_name})...")
        return openai.LLM(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
            model=model_name,
        )

    # Default to ultra-fast Groq LLM (~500ms Time to First Token)
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key or provider != "openrouter":
        logger.info("Using Ultra-Fast Groq LLM (llama-3.1-8b-instant)...")
        return groq.LLM(model="llama-3.1-8b-instant")

    # Fallback to Google Gemini
    logger.info("Using Google Gemini LLM (gemini-1.5-flash)...")
    return google.LLM(model="gemini-1.5-flash")


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

    # Initialize fast pipeline components per session with ultra-low latency settings
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="en",
        ),
        llm=get_llm(),
        tts=murf.TTS(
            voice="Anisha",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=1),
            min_buffer_size=1,
            text_pacing=False,
        ),
        vad=ctx.proc.userdata["vad"],
        min_endpointing_delay=0.05,
        preemptive_generation=True,
    )

    # Precision latency stage timing loggers
    @session.on("user_started_speaking")
    def _on_user_started():
        session._t_user_start = time.perf_counter()

    @session.on("user_stopped_speaking")
    def _on_user_stopped():
        session._t_speech_end = time.perf_counter()
        dur = round(
            session._t_speech_end
            - getattr(session, "_t_user_start", session._t_speech_end),
            3,
        )
        logger.info(f"🎙️ [STAGE 1 - VAD] User speech ended (Speech Duration: {dur}s)")

    @session.on("user_speech_committed")
    def _on_speech_committed(msg):
        session._t_stt_done = time.perf_counter()
        stt_latency = round(
            session._t_stt_done
            - getattr(session, "_t_speech_end", session._t_stt_done),
            3,
        )
        content = getattr(msg, "content", str(msg))
        logger.info(
            f"⚡ [STAGE 2 - DEEPGRAM STT] Final transcript: '{content}' (STT Latency: {stt_latency}s)"
        )

    @session.on("agent_started_speaking")
    def _on_agent_started():
        t_now = time.perf_counter()
        session._t_audio_start = t_now
        t_speech_end = getattr(session, "_t_speech_end", t_now)
        total_latency = round(t_now - t_speech_end, 3)
        logger.info(
            f"🔊 [STAGE 5 - TOTAL LATENCY] First word spoken by Kisan Vani! "
            f"(User Speech End -> First Word Spoken = {total_latency}s)"
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
        print(
            f"*** CALL ANALYTICS SAVED TO SQLITE ***: Status={status}, Duration={duration}s, Query={query_type}"
        )

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
        logger.info(
            f"🎤 [DIAGNOSTIC A - SPEECH DETECTED] User state: {ev.old_state} -> {ev.new_state}"
        )

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev):
        logger.info(
            f"📝 [DIAGNOSTIC B/C - STT TRANSCRIPT] Final={ev.is_final} | Text: '{ev.transcript}'"
        )

    @session.on("agent_state_changed")
    def _on_agent_state(ev):
        logger.info(
            f"🤖 [DIAGNOSTIC C/D/E - AGENT STATE] {ev.old_state} -> {ev.new_state}"
        )

    @session.on("conversation_item_added")
    def _on_item_added(ev):
        logger.info(
            f"💬 [DIAGNOSTIC C/D - CONVERSATION ITEM] Role={getattr(ev.item, 'role', 'unknown')}: '{getattr(ev.item, 'content', ev.item)}'"
        )

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
                pre_connect_audio=False,
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

    # 3. Trigger initial greeting or Day 10 Demo Narration
    demo_mode = os.getenv("KISAN_VANI_DEMO_MODE", "").lower() in ("true", "1", "yes")

    if demo_mode:
        demo_sentences = [
            "Namaste! I'm Kisan Vani, an AI voice assistant built to help Indian farmers.",
            "Let me show you my journey through the 10 Days of Voice Agents — VoiceForBharat Edition.",
            "On Day 1, I started as a basic real-time voice agent.",
            "On Day 2, I gained a clear personality, objectives, and safety guardrails so that I could provide useful and responsible agricultural assistance.",
            "Then I learned to work with agricultural information and tools, helping farmers with questions such as weather and mandi price information.",
            "I also learned to remember returning farmers using persistent memory, so conversations can become more contextual over time.",
            "Next came real phone communication. I was connected to LiveKit telephony so I could make outbound calls and communicate with farmers through SIP.",
            "I also learned how to ask for human help when a situation needs a specialist or human intervention.",
            "On Day 8, I gained a call analytics dashboard that tracks total calls, successful calls, and failed calls using real call data.",
            "On Day 9, I became a multi-agent system. When a farmer has a complex crop disease or pest problem, I can hand the conversation to a Crop Specialist agent and pass along the issue summary.",
            "Behind me are technologies including LiveKit for real-time communication, Deepgram for speech recognition, an LLM for reasoning, and Murf Falcon for natural voice generation.",
            "And today, on Day 10, I'm sharing everything I learned so that other developers can build their own voice agents.",
            "I'm Kisan Vani — a voice-first AI assistant built for Indian farmers. This is my 10-day journey.",
            "I'm ready to help you now."
        ]

        async def run_demo_narration():
            logger.info("🎬 [DEMO MODE ACTIVE] Triggering smooth sentence-by-sentence Day 10 narration...")
            for sentence in demo_sentences:
                try:
                    handle = session.say(sentence, add_to_chat_ctx=True)
                    await handle.wait_for_playout()
                    await asyncio.sleep(0.15)
                except Exception as err:
                    logger.warning(f"Demo narration playout step notice: {err}")
                    break

        asyncio.create_task(run_demo_narration())
    else:
        greeting = "Hello! Welcome to Kisan Vani. How can I assist you with your crops or farm today?"
        session.say(greeting, add_to_chat_ctx=True)


if __name__ == "__main__":
    if sys.platform == "win32":
        # Silence benign Windows asyncio Proactor socket shutdown warnings on client disconnect
        def _ignore_win_proactor_reset(loop, context):
            exception = context.get("exception")
            if isinstance(exception, (ConnectionResetError, OSError)) and getattr(
                exception, "winerror", None
            ) in (10054, 10053):
                return
            loop.default_exception_handler(context)

        try:
            loop = asyncio.get_event_loop()
            loop.set_exception_handler(_ignore_win_proactor_reset)
        except Exception:
            pass

    cli.run_app(server)
