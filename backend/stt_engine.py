import os
import requests
from typing import Tuple, Optional
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

load_dotenv()

def create_stt_session():
    session = requests.Session()
    adapter = HTTPAdapter(
        pool_connections=20,
        pool_maxsize=20,
        max_retries=Retry(total=1, backoff_factor=0.05, status_forcelist=[500, 502, 503, 504])
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        "Connection": "keep-alive"
    })
    return session

class DeepgramSTTEngine:
    """
    Deepgram Speech-to-Text Engine for Kisan Vani.
    Uses Deepgram's nova-3 model for ultra-fast, accurate speech transcription.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY", "").strip()
        self.session = create_stt_session()

    def transcribe_audio(self, audio_bytes: bytes, content_type: str = "audio/webm") -> Tuple[bool, str]:
        """
        Transcribes audio binary using Deepgram REST API with persistent connection pooling.
        """
        if not self.api_key or self.api_key in ["your_deepgram_api_key_here", "YOUR_API_KEY"]:
            return False, "Deepgram API key not configured."

        endpoint = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&detect_language=true"
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type if content_type else "audio/webm"
        }

        try:
            response = self.session.post(endpoint, headers=headers, data=audio_bytes, timeout=6)
            if response.status_code == 200:
                data = response.json()
                channels = data.get("results", {}).get("channels", [])
                if channels:
                    alternatives = channels[0].get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "").strip()
                        if transcript:
                            print(f"🎙️ [Deepgram STT] Recognized transcript: '{transcript}'")
                            return True, transcript
                return False, "No audible speech detected."
            else:
                print(f"⚠️ [Deepgram STT] Status {response.status_code}: {response.text}")
                return False, "No audible speech detected."
        except Exception as e:
            print(f"❌ [Deepgram STT] Error: {e}")
            return False, f"Deepgram connection error: {str(e)}"
