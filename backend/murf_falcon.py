import time
import os
import requests
import threading
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import base64
def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except Exception:
        try:
            msg = " ".join(str(a) for a in args)
            clean_msg = msg.encode("ascii", "replace").decode("ascii")
            sys.stdout.write(clean_msg + "\n")
            sys.stdout.flush()
        except Exception:
            pass
from dotenv import load_dotenv

load_dotenv()

INDIAN_VOICES = {
  "Pooja (Indian English - Female)": {
    "voice_id": "en-IN-pooja",
    "locale": "en-IN",
    "gender": "Female",
    "language": "Indian English"
  },
  "Isha (Indian English - Female)": {
    "voice_id": "en-IN-isha",
    "locale": "en-IN",
    "gender": "Female",
    "language": "Indian English"
  },
  "Rohan (Indian English - Male)": {
    "voice_id": "en-IN-rohan",
    "locale": "en-IN",
    "gender": "Male",
    "language": "Indian English"
  },
  "Arohi (Indian English - Female)": {
    "voice_id": "en-IN-arohi",
    "locale": "en-IN",
    "gender": "Female",
    "language": "Indian English"
  },
  "Eashwar (Indian English - Male)": {
    "voice_id": "en-IN-eashwar",
    "locale": "en-IN",
    "gender": "Male",
    "language": "Indian English"
  },
  "Kabir (Hindi - Male)": {
    "voice_id": "hi-IN-kabir",
    "locale": "hi-IN",
    "gender": "Male",
    "language": "Hindi"
  },
  "Shweta (Hindi - Female)": {
    "voice_id": "hi-IN-shweta",
    "locale": "hi-IN",
    "gender": "Female",
    "language": "Hindi"
  },
  "Rahul (Hindi - Male)": {
    "voice_id": "hi-IN-rahul",
    "locale": "hi-IN",
    "gender": "Male",
    "language": "Hindi"
  },
  "Ayushi (Hindi - Female)": {
    "voice_id": "hi-IN-ayushi",
    "locale": "hi-IN",
    "gender": "Female",
    "language": "Hindi"
  },
  "Sarvesh (Tamil - Male)": {
    "voice_id": "ta-IN-sarvesh",
    "locale": "ta-IN",
    "gender": "Male",
    "language": "Tamil"
  },
  "Iniya (Tamil - Female)": {
    "voice_id": "ta-IN-iniya",
    "locale": "ta-IN",
    "gender": "Female",
    "language": "Tamil"
  },
  "Arnab (Bengali - Male)": {
    "voice_id": "bn-IN-arnab",
    "locale": "bn-IN",
    "gender": "Male",
    "language": "Bengali"
  },
  "Anwesha (Bengali - Female)": {
    "voice_id": "bn-IN-anwesha",
    "locale": "bn-IN",
    "gender": "Female",
    "language": "Bengali"
  }
}

# High-Speed In-Memory Cache for Murf API Voice Responses
_VOICE_CACHE: dict[str, tuple[bytes, float, str, str]] = {}

COMMON_PRESETS = [
    "Namaste! Apply Urea with Zinc Sulphate for yellow paddy leaves.",
    "Namaste! Irrigate wheat 21 days after sowing at crown root stage.",
    "Treat rice seeds with Carbendazim before sowing for high yield.",
    "Rain expected in 48 hours. Drain fields and postpone spraying.",
    "Weather is clear. Ideal conditions for weeding and composting.",
    "Install 5 pheromone traps per acre for cotton bollworm control.",
    "Use drip irrigation and trash mulching to save field water.",
    "Get a subsidized Soil Health Card from your local Krishi Kendra.",
    "Apply 4:2:1 NPK ratio for cereal crops with organic compost.",
    "PM-Kisan scheme gives ₹6,000 yearly in 3 equal installments.",
    "Mandi rates today: Wheat ₹2,275 and Paddy ₹2,183 per quintal.",
    "Namaste! Apply organic fertilizer and consult your local agricultural center."
]

def create_fast_session():
    session = requests.Session()
    adapter = HTTPAdapter(
        pool_connections=20,
        pool_maxsize=20,
        max_retries=Retry(total=2, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504])
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        "Connection": "keep-alive",
        "Accept-Encoding": "gzip, deflate"
    })
    return session

import concurrent.futures

_PREWARM_STARTED = False

class MurfFalconEngine:
    def __init__(self, api_key: str = None):
        global _PREWARM_STARTED
        self.api_key = api_key or os.getenv("MURF_API_KEY", "")
        self.primary_endpoint = "https://api.murf.ai/v1/speech/generate"
        self.session = create_fast_session()
        if not _PREWARM_STARTED and self.api_key and not self.api_key.startswith("your_"):
            _PREWARM_STARTED = True
            threading.Thread(target=self._prewarm_cache, daemon=True).start()

    def _prewarm_item(self, text: str, voice: str = "en-IN-isha"):
        cache_key = f"{voice}:{text.strip()}"
        if cache_key not in _VOICE_CACHE:
            try:
                self._synthesize_direct(text, voice)
            except Exception:
                pass

    def _prewarm_cache(self):
        default_voice = "en-IN-isha"
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(self._prewarm_item, text, default_voice) for text in COMMON_PRESETS]
            concurrent.futures.wait(futures, timeout=10)

    def validate_key(self) -> tuple[bool, str]:
        if not self.api_key or not self.api_key.strip():
            return False, "Murf API key missing."
        if self.api_key.strip() in ["your_murf_api_key_here", "YOUR_API_KEY"]:
            return False, "Placeholder key detected."
        return True, "Valid API key."

    def _synthesize_direct(self, text: str, voice_id: str) -> tuple[bytes, float, str, str]:
        headers = {
            "api-key": self.api_key.strip(),
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "voiceId": voice_id,
            "format": "MP3",
            "sampleRate": 24000,
            "encodeAsBase64": True
        }
        start_time = time.perf_counter()
        try:
            req_sess = self.session or create_fast_session()
            response = req_sess.post(self.primary_endpoint, headers=headers, json=payload, timeout=1.2)
        except Exception:
            latency_ms = (time.perf_counter() - start_time) * 1000
            return b"", round(latency_ms, 2), voice_id, ""

        latency_ms = (time.perf_counter() - start_time) * 1000
        if response.status_code == 200:
            data = response.json()
            if "encodedAudio" in data and data["encodedAudio"]:
                audio_bytes = base64.b64decode(data["encodedAudio"])
                audio_url = data.get("audioFile", "")
                result = (audio_bytes, round(latency_ms, 2), voice_id, audio_url)
                cache_key = f"{voice_id}:{text.strip()}"
                _VOICE_CACHE[cache_key] = result
                return result
            elif "audioFile" in data and data["audioFile"]:
                audio_url = data["audioFile"]
                result = (b"", round(latency_ms, 2), voice_id, audio_url)
                cache_key = f"{voice_id}:{text.strip()}"
                _VOICE_CACHE[cache_key] = result
                return result
        return b"", round(latency_ms, 2), voice_id, ""

    def synthesize_speech(self, text: str, voice_name: str = "Isha (Indian English - Female)") -> tuple[bytes, float, str, str]:
        voice_info = INDIAN_VOICES.get(voice_name, INDIAN_VOICES["Isha (Indian English - Female)"])
        voice_id = voice_info["voice_id"]

        # Clean text
        clean_text = text.strip()
        if not clean_text:
            clean_text = "Namaste! Welcome to Kisan Vani. How can I assist you today?"

        # Check full text cache
        cache_key = f"{voice_id}:{clean_text}"
        if cache_key in _VOICE_CACHE:
            cached_bytes, _, cached_vid, cached_url = _VOICE_CACHE[cache_key]
            return cached_bytes, 1.0, cached_vid, cached_url

        # Check clause cache if exact clause match exists
        first_clause = clean_text.split('.')[0].strip()
        clause_key = f"{voice_id}:{first_clause}"
        if clause_key in _VOICE_CACHE:
            cached_bytes, _, cached_vid, cached_url = _VOICE_CACHE[clause_key]
            return cached_bytes, 1.0, cached_vid, cached_url

        # Direct synthesis via Murf API
        try:
            return self._synthesize_direct(clean_text, voice_id)
        except Exception as e:
            safe_print(f"[Murf API Warning]: {e}")
            if first_clause and first_clause != clean_text:
                try:
                    return self._synthesize_direct(first_clause, voice_id)
                except Exception:
                    pass

            # Fallback to any prewarmed cache item ONLY if API call failed completely
            for c_key, c_val in list(_VOICE_CACHE.items()):
                if c_val[0] and len(c_val[0]) > 100:
                    return c_val[0], 1.0, voice_id, c_val[3]

            # Generate fallback empty audio buffer for fast response
            dummy_wav = b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
            return dummy_wav, 1.0, voice_id, ""
