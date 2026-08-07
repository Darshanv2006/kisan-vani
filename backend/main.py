import os
import sys
import base64
import time
from dotenv import load_dotenv

load_dotenv()

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def safe_print(*args, **kwargs):
    try:
        msg = " ".join(str(a) for a in args)
        sys.stdout.write(msg + "\n")
        sys.stdout.flush()
    except Exception:
        try:
            msg = " ".join(str(a) for a in args)
            clean_msg = msg.encode("ascii", "replace").decode("ascii")
            sys.stdout.write(clean_msg + "\n")
            sys.stdout.flush()
        except Exception:
            pass
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

try:
    from backend.murf_falcon import MurfFalconEngine, INDIAN_VOICES
    from backend.llm_engine import AgriLLMEngine
    from backend.stt_engine import DeepgramSTTEngine
except ImportError:
    from murf_falcon import MurfFalconEngine, INDIAN_VOICES
    from llm_engine import AgriLLMEngine
    from stt_engine import DeepgramSTTEngine

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
    stt_latency_ms: Optional[float] = 0.0
    llm_latency_ms: Optional[float] = 0.0
    tts_latency_ms: Optional[float] = 0.0
    total_latency_ms: Optional[float] = 0.0
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
    voice_name: str = Form("Pooja (Indian English - Female)"),
    captured_text: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None)
):
    """
    Full End-to-End Ultra-Low Latency Pipeline with stage profiling:
    1. Deepgram STT / Fast-path WebSpeech
    2. Google Gemini / Groq Agri-LLM
    3. Murf Falcon TTS Voice
    """
    try:
        t_pipeline_start = time.perf_counter()
        audio_bytes = await audio_file.read()
        content_type = audio_file.content_type or "audio/webm"
        
        transcript = captured_text.strip() if (captured_text and captured_text.strip()) else ""

        # Step 1: Speech-to-Text
        t_stt_start = time.perf_counter()
        if not transcript:
            stt_success, transcript = stt_engine.transcribe_audio(audio_bytes, content_type=content_type)
            stt_latency_ms = round((time.perf_counter() - t_stt_start) * 1000, 1)
            if not stt_success or not transcript:
                print(f"[STT Note]: {transcript}")
                return VoiceQueryResponse(
                    success=False,
                    prompt="",
                    response_text="I couldn't hear any speech clearly. Please speak your agricultural question.",
                    audio_b64="",
                    audio_url="",
                    latency_ms=0,
                    stt_latency_ms=stt_latency_ms,
                    llm_latency_ms=0.0,
                    tts_latency_ms=0.0,
                    total_latency_ms=round((time.perf_counter() - t_pipeline_start) * 1000, 1),
                    voice_id="",
                    error=str(transcript)
                )
        else:
            stt_latency_ms = 0.0  # Fast-path WebSpeech

        # Step 2: Gemini / Groq LLM Generation
        t_llm_start = time.perf_counter()
        ai_response = llm_engine.generate_response(transcript)
        llm_latency_ms = round((time.perf_counter() - t_llm_start) * 1000, 1)

        # Step 3: Murf Falcon TTS Voice Synthesis
        current_murf = murf_engine
        if api_key and api_key.strip():
            current_murf = MurfFalconEngine(api_key=api_key.strip())

        t_tts_start = time.perf_counter()
        audio_bytes, tts_latency, voice_id, audio_url = current_murf.synthesize_speech(
            text=ai_response, voice_name=voice_name
        )
        tts_latency_ms = round((time.perf_counter() - t_tts_start) * 1000, 1)

        total_latency_ms = round((time.perf_counter() - t_pipeline_start) * 1000, 1)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else ""

        print("\n[Kisan Vani Voice Pipeline Profile]")
        print(f"|-- STT Latency:    {stt_latency_ms:6.1f} ms")
        print(f"|-- LLM Latency:    {llm_latency_ms:6.1f} ms")
        print(f"|-- TTS Latency:    {tts_latency_ms:6.1f} ms")
        print(f"`-- TOTAL Latency:  {total_latency_ms:6.1f} ms (Target: <2000 ms)\n")

        return VoiceQueryResponse(
            success=True,
            prompt=transcript,
            response_text=ai_response,
            audio_b64=audio_b64,
            audio_url=audio_url,
            latency_ms=total_latency_ms,
            stt_latency_ms=stt_latency_ms,
            llm_latency_ms=llm_latency_ms,
            tts_latency_ms=tts_latency_ms,
            total_latency_ms=total_latency_ms,
            voice_id=voice_id
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        safe_msg = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"[PIPELINE ERROR]: {safe_msg}")
        raise HTTPException(status_code=500, detail=f"Voice Pipeline Error: {safe_msg}")

@app.post("/api/chat-voice", response_model=VoiceQueryResponse)
def chat_and_synthesize(req: VoiceQueryRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    current_murf = murf_engine
    if req.api_key and req.api_key.strip():
        current_murf = MurfFalconEngine(api_key=req.api_key.strip())

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
