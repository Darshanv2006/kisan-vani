import time
import os
import requests
import json
import base64
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from dotenv import load_dotenv

load_dotenv()

INDIAN_VOICES = {
    "Anisha (Indian English - Female)": {
        "voice_id": "en-IN-isha",
        "locale": "en-IN",
        "gender": "Female",
        "language": "Indian English",
        "justification": "Selected for a warm, trustworthy, and clear tone ideal for rural agricultural advisory."
    },
    "Samar (Indian English - Male)": {
        "voice_id": "en-IN-rohan",
        "locale": "en-IN",
        "gender": "Male",
        "language": "Indian English",
        "justification": "Selected for a friendly, practical, and approachable farmer companion voice."
    },
    "Pooja (Hindi - Female)": {
        "voice_id": "hi-IN-shweta",
        "locale": "hi-IN",
        "gender": "Female",
        "language": "Hindi",
        "justification": "Selected for native Hindi region voice clarity and regional accessibility."
    },
    "Rahul (Hindi - Male)": {
        "voice_id": "hi-IN-kabir",
        "locale": "hi-IN",
        "gender": "Male",
        "language": "Hindi",
        "justification": "Selected for an authoritative and respectful male Hindi advisor tone."
    },
    "Priya (Tamil - Female)": {
        "voice_id": "ta-IN-iniya",
        "locale": "ta-IN",
        "gender": "Female",
        "language": "Tamil",
        "justification": "Selected for clear Tamil regional articulation and farming guidance."
    },
    "Karthik (Tamil - Male)": {
        "voice_id": "ta-IN-sarvesh",
        "locale": "ta-IN",
        "gender": "Male",
        "language": "Tamil",
        "justification": "Selected for friendly Tamil male agricultural advisory."
    },
    "Riya (Bengali - Female)": {
        "voice_id": "bn-IN-anwesha",
        "locale": "bn-IN",
        "gender": "Female",
        "language": "Bengali",
        "justification": "Selected for Eastern regional farming community advisory."
    }
}

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

class MurfFalconEngine:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("MURF_API_KEY", "")
        self.primary_endpoint = "https://api.murf.ai/v1/speech/generate"
        self.session = create_fast_session()

    def validate_key(self) -> tuple[bool, str]:
        if not self.api_key or not self.api_key.strip():
            return False, "Murf API key missing."
        if self.api_key.strip() in ["your_murf_api_key_here", "YOUR_API_KEY"]:
            return False, "Placeholder key detected."
        return True, "Valid API key."

    def synthesize_speech(self, text: str, voice_name: str = "Anisha (Indian English - Female)") -> tuple[bytes, float, str]:
        voice_info = INDIAN_VOICES.get(voice_name, INDIAN_VOICES["Anisha (Indian English - Female)"])
        voice_id = voice_info["voice_id"]

        headers = {
            "api-key": self.api_key.strip(),
            "Content-Type": "application/json"
        }

        payload = {
            "text": text,
            "voiceId": voice_id,
            "format": "MP3",
            "sampleRate": 24000
        }

        start_time = time.perf_counter()
        try:
            response = self.session.post(self.primary_endpoint, headers=headers, json=payload, timeout=6)
        except Exception:
            self.session = create_fast_session()
            response = self.session.post(self.primary_endpoint, headers=headers, json=payload, timeout=6)

        latency_ms = (time.perf_counter() - start_time) * 1000

        if response.status_code == 200:
            data = response.json()
            if "audioFile" in data:
                audio_res = self.session.get(data["audioFile"])
                return audio_res.content, round(latency_ms, 2), voice_id
            elif "encodedAudio" in data:
                return base64.b64decode(data["encodedAudio"]), round(latency_ms, 2), voice_id

        raise RuntimeError(f"Murf API Error: {response.status_code} - {response.text}")
