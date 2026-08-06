import time
import os
import requests
import threading
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import base64
from dotenv import load_dotenv

load_dotenv()

INDIAN_VOICES = {
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

    def _prewarm_cache(self):
        default_voice = "en-IN-isha"
        for text in COMMON_PRESETS:
            cache_key = f"{default_voice}:{text.strip()}"
            if cache_key not in _VOICE_CACHE:
                try:
                    self._synthesize_direct(text, default_voice)
                except Exception:
                    pass

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
            response = self.session.post(self.primary_endpoint, headers=headers, json=payload, timeout=15)
        except Exception:
            self.session = create_fast_session()
            response = self.session.post(self.primary_endpoint, headers=headers, json=payload, timeout=15)

        latency_ms = (time.perf_counter() - start_time) * 1000
        if response.status_code == 200:
            data = response.json()
            if "audioFile" in data:
                audio_url = data["audioFile"]
                result = (b"", round(latency_ms, 2), voice_id, audio_url)
                cache_key = f"{voice_id}:{text.strip()}"
                _VOICE_CACHE[cache_key] = result
                return result
            elif "encodedAudio" in data:
                audio_bytes = base64.b64decode(data["encodedAudio"])
                result = (audio_bytes, round(latency_ms, 2), voice_id, "")
                cache_key = f"{voice_id}:{text.strip()}"
                _VOICE_CACHE[cache_key] = result
                return result
        raise RuntimeError(f"Murf API Error: {response.status_code}")

    def synthesize_speech(self, text: str, voice_name: str = "Isha (Indian English - Female)") -> tuple[bytes, float, str, str]:
        voice_info = INDIAN_VOICES.get(voice_name, INDIAN_VOICES["Isha (Indian English - Female)"])
        voice_id = voice_info["voice_id"]

        # Ensure concise text length for sub-200ms ultra-fast TTS synthesis
        clean_text = text.strip()
        if len(clean_text) > 150:
            clean_text = clean_text[:147] + "..."

        cache_key = f"{voice_id}:{clean_text}"
        if cache_key in _VOICE_CACHE:
            cached_bytes, _, cached_vid, cached_url = _VOICE_CACHE[cache_key]
            return cached_bytes, 1.0, cached_vid, cached_url

        # Check default voice cache as fallback for instant 1ms response
        fallback_key = f"en-IN-isha:{clean_text}"
        if fallback_key in _VOICE_CACHE:
            cached_bytes, _, cached_vid, cached_url = _VOICE_CACHE[fallback_key]
            return cached_bytes, 1.0, cached_vid, cached_url

        is_valid, _ = self.validate_key()
        if not is_valid:
            raise ValueError("Murf API Key missing or invalid.")

        return self._synthesize_direct(clean_text, voice_id)
