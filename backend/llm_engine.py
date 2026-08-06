import os
import time
import requests
from typing import Optional

class AgriLLMEngine:
    """
    Ultra-Fast Agricultural LLM & Advisory Response Generator for Kisan Vani.
    Priority: Groq (sub-50ms) → Gemini Flash → Knowledge Base fallback.
    Optimized for sub-200ms Murf Falcon TTS voice synthesis.
    """
    
    SYSTEM_PROMPT = (
        "You are Kisan Vani, a helpful AI agricultural assistant for Indian farmers. "
        "Provide direct, helpful, and concise answers in 1-2 clear sentences (maximum 30 words). "
        "Be friendly, start with Namaste, and give practical actionable advice."
    )

    AGRI_KNOWLEDGE_BASE = {
        "welcome": "Namaste! Welcome to Kisan Vani voice assistant. How can I help you with your crops today?",
        "hello": "Namaste! Welcome to Kisan Vani. I am your AI farming assistant. Ask me about crops, fertilizers, Mandi prices, or PM-Kisan.",
        "hi": "Namaste! How can I assist you with your farming and crops today?",
        "hey": "Namaste! Welcome to Kisan Vani. Feel free to ask any farming question.",
        "help": "Namaste! I can assist you with crop diseases, fertilizer dosage, Mandi rates, weather updates, and PM-Kisan subsidies.",
        "crop": "Namaste! For optimal crop health, maintain proper drainage, test soil NPK levels, and use recommended fertilizers.",
        "pest": "Namaste! For pest management, install pheromone traps and use organic Neem oil spray at 5ml per liter of water.",
        "disease": "Namaste! Identify yellow or brown leaves early. Spray recommended fungicide or Neem oil solution during morning hours.",

        # PM-Kisan & Schemes
        "pm-kisan": "Namaste! For PM-Kisan subsidy, link your Aadhaar card with your bank account and update e-KYC on pmkisan.gov.in for ₹6,000 yearly support.",
        "document": "Namaste! Bring your Aadhaar Card, land 7/12 extract, updated bank passbook, and mobile number to your local Krishi Vigyan Kendra.",
        "subsidy": "Namaste! PM-Kisan offers ₹6,000 yearly, and PM Krishi Sinchayee Yojana provides up to 80% subsidy on drip irrigation systems.",
        "scheme": "Namaste! Key farming schemes include PM-Kisan ₹6,000 support, PM Fasal Bima crop insurance, and Soil Health Card subsidies.",
        "kisan": "Namaste! PM-Kisan provides ₹6,000 annual financial support directly to verified farmer bank accounts in three equal installments.",

        # Crop specific (English & Hindi)
        "paddy": "Namaste! For yellowing paddy leaves, apply 10 kg Urea mixed with 5 kg Zinc Sulphate per acre and maintain 2 cm standing water.",
        "dhan": "Namaste! For paddy (dhan) yellow leaves, apply 10 kg Urea with 5 kg Zinc Sulphate per acre during tillering stage.",
        "yellow": "Namaste! Yellow leaves signal nitrogen or zinc deficiency. Spray 1% Urea with 0.5% Zinc Sulphate during cool morning hours.",
        "wheat": "Namaste! Irrigate wheat 21 days after sowing at CRI stage. For yellow rust spots, spray Propiconazole 25% EC at 1 ml per liter.",
        "gehu": "Namaste! For wheat (gehu), irrigate 21 days after sowing. Spray Propiconazole 25% EC if yellow rust fungal spots appear on leaves.",
        "rice": "Namaste! Treat rice seeds with Carbendazim before sowing. Maintain 2 to 3 cm standing water and apply Neem-coated Urea.",
        "cotton": "Namaste! For cotton pink bollworm, install 5 pheromone traps per acre. Spray Emamectin Benzoate 5% SG at 4 grams per 10 liters.",
        "kapas": "Namaste! For cotton pink bollworm, use 5 pheromone traps per acre and spray Emamectin Benzoate 5% SG if pest count rises.",
        "sugarcane": "Namaste! Use drip irrigation and trash mulching between sugarcane rows to save 40% water and boost crop yield by 20%.",
        "ganna": "Namaste! For sugarcane, trash mulching between crop rows retains soil moisture, saving 40% water and improving growth.",
        "tomato": "Namaste! For tomato leaf curl virus, install yellow sticky traps for whiteflies and spray Neem oil at 3 ml per liter of water.",
        "tamatar": "Namaste! For tomato leaf curl virus, use yellow sticky traps for whiteflies and spray 5 ml Neem oil per liter of water.",

        # Weather & Mandi
        "rain": "Namaste! Moderate rain expected within 48 hours. Clear field drainage channels to prevent root rot and hold fertilizer spraying.",
        "barish": "Namaste! Rain is expected within 48 hours. Ensure open drainage in low-lying fields and postpone chemical spraying.",
        "weather": "Namaste! Weather is suitable for weeding and field work. Keep field drainage clear and ensure soil moisture before top-dressing.",
        "mausam": "Namaste! Current weather favors field cultivation and weeding. Maintain proper soil moisture and field drainage.",
        "mandi": "Namaste! Mandi prices: Wheat ₹2,275/qtl, Paddy ₹2,183/qtl, Mustard ₹5,450/qtl, and Tomatoes ₹1,800/qtl. Check e-NAM for live rates.",
        "price": "Namaste! Mandi market prices remain stable. Check daily live crop rates on the government e-NAM portal or local APMC market.",
        "daam": "Namaste! Mandi benchmark prices: Wheat ₹2,275 per quintal, Paddy ₹2,183 per quintal, Mustard ₹5,450 per quintal.",

        # Soil & Fertilizer
        "soil": "Namaste! Visit your local Krishi Vigyan Kendra to test soil NPK levels for your custom Soil Health Card recommendations.",
        "mitti": "Namaste! Soil testing at Krishi Vigyan Kendra helps optimize NPK fertilizer dosage, saving money and boosting yield.",
        "fertilizer": "Namaste! Use a balanced NPK 4:2:1 ratio with compost. Apply Neem-coated Urea in split doses for maximum absorption.",
        "khad": "Namaste! Apply 4:2:1 NPK fertilizer with organic compost. Divide Neem-coated Urea into split doses during crop tillering.",
        "organic": "Namaste! Organic farming with Jeevamrut and Neem cake improves soil microbes, retains moisture, and fetches higher prices.",
        "water": "Namaste! Micro-drip irrigation saves 50% water. Small farmers can get up to 80% government subsidy under PM Krishi Sinchayee.",
        "paani": "Namaste! Drip irrigation cuts water usage by 50%. You can claim up to 80% government subsidy for installing drip systems."
    }

    def __init__(self, openai_api_key: Optional[str] = None, google_api_key: Optional[str] = None):
        self.openai_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self.google_key = google_api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY", "").strip()
        self.session = requests.Session()

    def _call_groq(self, prompt: str) -> Optional[str]:
        """
        Ultra-fast Groq Cloud inference (sub-50ms) using Llama 3.1 8B.
        """
        if not self.groq_key or self.groq_key.startswith("your_"):
            return None
        try:
            start = time.time()
            res = self.session.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 40,
                    "temperature": 0.3,
                    "stream": False,
                },
                timeout=1.5,
            )
            elapsed = int((time.time() - start) * 1000)
            if res.status_code == 200:
                data = res.json()
                text = data["choices"][0]["message"]["content"].strip()
                if text:
                    print(f"[Groq] LLM response in {elapsed}ms: {text[:80]}...")
                    return text
        except Exception as e:
            print(f"[Groq] Error: {e}")
        return None

    def _call_gemini(self, prompt: str) -> Optional[str]:
        """
        Google AI Studio Gemini 1.5 Flash inference (~150-250ms).
        """
        if not self.google_key or not self.google_key.strip() or self.google_key.startswith("your_"):
            return None
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.google_key.strip()}"
            payload = {
                "contents": [{"parts": [{"text": f"{self.SYSTEM_PROMPT}\n\nFarmer Query: {prompt}"}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 25},
            }
            res = self.session.post(url, json=payload, timeout=1.5)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            return text
        except Exception:
            pass
        return None

    def generate_response(self, prompt: str) -> str:
        """
        Generates ultra-fast 1-2 sentence concise agricultural advisory response.
        Priority: Fast-Path Knowledge Base (instant 0ms) → Groq → Gemini Flash → Fallback.
        """
        prompt_lower = prompt.lower().strip()

        # 1. Fast-Path Knowledge Base Lookup (<1ms response time)
        intent_priority = [
            "welcome", "pm-kisan", "document", "subsidy", "scheme", "kisan",
            "mandi", "price", "daam", "weather", "rain", "barish", "mausam",
            "yellow", "pest", "fertilizer", "khad", "organic", "soil", "mitti", "water", "paani",
            "paddy", "dhan", "wheat", "gehu", "rice", "cotton", "kapas", "sugarcane", "ganna", "tomato", "tamatar"
        ]
        for key in intent_priority:
            if key in prompt_lower and key in self.AGRI_KNOWLEDGE_BASE:
                print(f"[KnowledgeBase Fast-Path] Matched keyword '{key}' in <1ms")
                return self.AGRI_KNOWLEDGE_BASE[key]

        for key, response in self.AGRI_KNOWLEDGE_BASE.items():
            if key in prompt_lower:
                print(f"[KnowledgeBase Fast-Path] Matched '{key}' in <1ms")
                return response

        # 2. Groq Cloud — Ultra-fast sub-50ms Llama 3.1 8B
        groq_result = self._call_groq(prompt)
        if groq_result:
            return groq_result

        # 3. Google AI Studio (Gemini Flash)
        gemini_result = self._call_gemini(prompt)
        if gemini_result:
            return gemini_result

        # 4. OpenAI fallback if configured
        if self.openai_key and self.openai_key.startswith("sk-"):
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.openai_key)
                completion = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=40,
                    temperature=0.3
                )
                return completion.choices[0].message.content.strip()
            except Exception:
                pass

        # 5. Dynamic Fallback
        return f"Namaste! For '{prompt.capitalize()}', consult your local Krishi Vigyan Kendra or APMC office for guidance."

if __name__ == "__main__":
    engine = AgriLLMEngine()
    start = time.time()
    result = engine.generate_response("What is the price of wheat in mandi?")
    elapsed = int((time.time() - start) * 1000)
    print(f"[{elapsed}ms] Response: {result}")
