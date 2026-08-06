import os
import base64
import time
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

try:
    from backend.murf_falcon import MurfFalconEngine, INDIAN_VOICES
    from backend.llm_engine import AgriLLMEngine
    from backend.stt_engine import DeepgramSTTEngine
except ImportError:
    from murf_falcon import MurfFalconEngine, INDIAN_VOICES
    from llm_engine import AgriLLMEngine
    from stt_engine import DeepgramSTTEngine

load_dotenv()

app = FastAPI(
    title="Kisan Vani AI Voice Platform",
    description="Sub-100ms Regional Voice Assistant Backend for Indian Farmers",
    version="2.0.0"
)

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Core AI Engines
effective_api_key = os.getenv("MURF_API_KEY", "").strip()
if effective_api_key in ["your_murf_api_key_here", "YOUR_API_KEY"]:
    effective_api_key = ""

murf_engine = MurfFalconEngine(api_key=effective_api_key)
llm_engine = AgriLLMEngine()
stt_engine = DeepgramSTTEngine()

class VoiceQueryRequest(BaseModel):
    prompt: str
    voice_name: Optional[str] = "Isha (Indian English - Female)"
    api_key: Optional[str] = None

class VoiceQueryResponse(BaseModel):
    success: bool
    prompt: str
    response_text: str
    audio_b64: str
    audio_url: Optional[str] = ""
    latency_ms: float
    voice_id: str
    error: Optional[str] = None

@app.get("/api/health")
def health_check():
    is_valid, msg = murf_engine.validate_key()
    return {
        "status": "online",
        "murf_connected": is_valid,
        "murf_message": msg,
        "engine": "Murf Falcon 2",
        "stt": "Deepgram nova-3",
        "llm": "Google Gemini / Agri-LLM"
    }

@app.get("/api/voices")
def get_voices():
    return {"voices": INDIAN_VOICES}

@app.post("/api/pipeline-audio", response_model=VoiceQueryResponse)
async def pipeline_audio(
    audio_file: UploadFile = File(...),
    voice_name: str = Form("Isha (Indian English - Female)"),
    captured_text: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None)
):
    """
    Full End-to-End Pipeline:
    1. Microphone Audio -> Deepgram STT (Speech-to-Text) / Fast-path WebSpeech
    2. Transcribed Prompt -> Google Gemini / Groq Agri-LLM
    3. AI Response -> Murf Falcon API (TTS Voice)
    """
    try:
        audio_bytes = await audio_file.read()
        content_type = audio_file.content_type or "audio/webm"
        
        start_time = time.time()
        transcript = captured_text.strip() if (captured_text and captured_text.strip()) else ""

        # Step 1: Deepgram Speech-to-Text (if fast-path transcript not provided)
        if not transcript:
            stt_success, transcript = stt_engine.transcribe_audio(audio_bytes, content_type=content_type)
            if not stt_success or not transcript:
                print(f"⚠️ Speech Recognition Note: {transcript}")
                return VoiceQueryResponse(
                    success=False,
                    prompt="",
                    response_text="I couldn't hear any speech clearly. Please speak your agricultural question.",
                    audio_b64="",
                    audio_url="",
                    latency_ms=0,
                    voice_id="",
                    error=str(transcript)
                )

        # Step 2: Google Gemini / Agri-LLM Advisory
        ai_response = llm_engine.generate_response(transcript)

        # Step 3: Murf Falcon API Text-to-Speech (MURF FALCON IS STRICTLY ONLY TTS)
        current_murf = murf_engine
        if api_key and api_key.strip():
            current_murf = MurfFalconEngine(api_key=api_key.strip())

        audio_bytes, tts_latency, voice_id, audio_url = current_murf.synthesize_speech(
            text=ai_response, voice_name=voice_name
        )

        total_latency = round((time.time() - start_time) * 1000, 1)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""

        return VoiceQueryResponse(
            success=True,
            prompt=transcript,
            response_text=ai_response,
            audio_b64=audio_b64,
            audio_url=audio_url,
            latency_ms=tts_latency,
            voice_id=voice_id
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Voice Pipeline Error: {str(e)}")

@app.post("/api/chat-voice", response_model=VoiceQueryResponse)
def chat_and_synthesize(req: VoiceQueryRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    current_murf = murf_engine
    if req.api_key and req.api_key.strip():
        current_murf = MurfFalconEngine(api_key=req.api_key.strip())

    is_valid, err_msg = current_murf.validate_key()
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Murf API Key Error: {err_msg}")

    try:
        start_time = time.time()
        
        # 1. Generate Domain-Specific Agri Answer (Google Gemini / Agri-LLM)
        ai_response = llm_engine.generate_response(req.prompt)

        # 2. Synthesize Speech via Murf Falcon 2 (MURF FALCON IS STRICTLY ONLY TTS)
        audio_bytes, tts_latency, voice_id, audio_url = current_murf.synthesize_speech(
            text=ai_response, voice_name=req.voice_name
        )

        total_latency = round((time.time() - start_time) * 1000, 1)

        # Base64 encode audio if present, otherwise rely on direct URL
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""

        return VoiceQueryResponse(
            success=True,
            prompt=req.prompt,
            response_text=ai_response,
            audio_b64=audio_b64,
            audio_url=audio_url,
            latency_ms=tts_latency,
            voice_id=voice_id
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice Processing Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
