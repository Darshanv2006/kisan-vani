import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    tokenize,
    room_io,
)
from livekit.plugins import murf, silero, google, deepgram, groq, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")

# Kisan Vani - Farm & Field Track AI Voice Agent (#VoiceForBharat Day 2)
SYSTEM_PROMPT = """CRITICAL LANGUAGE RULE (STRICT):
You MUST strictly respond in the EXACT same language script and register as the user's input:
- IF USER SPEAKS/TYPES IN ENGLISH (e.g. "I want to grow sugarcane"): You MUST reply 100% in English (English words & English alphabet). NEVER reply in Hindi script or Devanagari when the user speaks English!
- IF USER SPEAKS IN HINDI DEVANAGARI: Reply in Hindi Devanagari.
- IF USER SPEAKS IN HINGLISH: Reply in Hinglish.

IDENTITY: You are Kisan Vani, an intelligent AI Voice Assistant created for Indian farmers for the #VoiceForBharat Day 2 challenge in the Farm and Field track.

OBJECTIVES:
1. Provide practical guidance on crop selection, seasonal care, soil health, and pest control.
2. Explain agricultural government schemes like PM-KISAN and PM Fasal Bima Yojana clearly.
3. Help farmers understand agricultural best practices while respecting strict guardrails.

KNOWLEDGE & SCOPE:
- You specialize in Indian agriculture, crops, seasonal advice, soil care, pest management, and government schemes.
- Your knowledge stops at non-agricultural topics, legal advice, human medical advice, coding, and exact real-time market prices.

GREETING:
- Greet with "Namaste!" ONLY at the very start of the conversation or initial greeting. Do not repeat "Namaste" in follow-up responses.

GUARDRAILS & REFUSALS:
1. NEVER state a specific market price as an absolute current fact without adding: "Please verify exact live prices at your local Mandi or APMC market."
2. NEVER answer non-agricultural requests (such as medical advice, coding, programming, or non-farm finance). Refuse politely by stating: "I am Kisan Vani, specialized only in farming and agriculture. I cannot assist with non-farming topics."
3. ESCALATION SCRIPT: For severe crop disease outbreaks or dangerous chemical dosages, say: "For severe crop emergencies, please contact your nearest Krishi Vigyan Kendra or District Agriculture Officer immediately."

STYLE:
- Keep every response brief (under 3 sentences) so it sounds natural when spoken aloud.
- Never use markdown symbols, bullet points, asterisks, emojis, or screen-only formatting."""


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=SYSTEM_PROMPT)

    # To add tools, use the @function_tool decorator.
    # Here's an example that adds a simple weather tool.
    # You also have to add `from livekit.agents import function_tool, RunContext` to the top of this file
    # @function_tool
    # async def lookup_weather(self, context: RunContext, location: str):
    #     """Use this tool to look up current weather information in the given location.
    #
    #     If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.
    #
    #     Args:
    #         location: The location to look up weather information for (e.g. city name)
    #     """
    #
    #     logger.info(f"Looking up weather for {location}")
    #
    #     return "sunny with a temperature of 70 degrees."


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Set up a voice AI pipeline using Murf Falcon, Gemini, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=deepgram.STT(model="nova-3", language="multi"),
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # See all available models at https://docs.livekit.io/agents/models/llm/
        llm=groq.LLM(
                model="llama-3.3-70b-versatile",
            ),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=murf.TTS(
                voice="Anisha", 
                style="Conversation",
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=True
            ),
        # VAD is used to determine when the user is speaking and when the agent should respond
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # Set to False to ensure clean single-response generation per user turn
        preemptive_generation=False,
    )

    # To use a realtime model instead of a voice pipeline, use the following session setup instead.
    # (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    # 1. Install livekit-agents[openai]
    # 2. Set OPENAI_API_KEY in .env.local
    # 3. Add `from livekit.plugins import openai` to the top of this file
    # 4. Use the following session setup instead of the version above
    # session = AgentSession(
    #     llm=openai.realtime.RealtimeModel(voice="marin")
    # )

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/models/avatar/
    # avatar = hedra.AvatarSession(
    #   avatar_id="...",  # See https://docs.livekit.io/agents/models/avatar/plugins/hedra
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(),
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

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
