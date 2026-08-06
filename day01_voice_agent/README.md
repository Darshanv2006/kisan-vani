# Day 1: Get Your Voice Agent Talking — Kisan Vani 🌾

Part of **10 Days of Voice Agents — #VoiceForBharat Edition** hosted by **Murf AI**.

## 📌 Track Selected: Farm & Field
**Project Name:** Kisan Vani (Voice Companion for Farmers)
**Goal:** Empower rural Indian farmers with real-time crop, weather, and market price advisories in clear regional/Indian English voices.

---

## 🎙️ Murf Falcon TTS Integration
- **Model:** `falcon-2` (Ultra-low latency streaming engine)
- **Voice Selected:** Anisha (`en-IN-anisha`) / Samar (`en-IN-samar`) / Pooja (`hi-IN-pooja`)
- **Voice Justification:** We selected 'Anisha' (en-IN Warm Female) because an agricultural advisor must convey warm, trustworthy, and clear guidance to farmers in rural India.

---

## ⚡ Latency Tracking (Advanced Bonus)
- Measured **Time-To-First-Byte (TTFB)** latency from query submission to audio generation.
- Recorded Latency: **~150ms - 200ms**.

---

## 🚀 How to Run Locally

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure API Key:**
   Create a `.env` file in the root folder or enter your `MURF_API_KEY` in the app sidebar.

3. **Launch Streamlit App:**
   ```bash
   streamlit run day01_voice_agent/app.py
   ```

4. Open `http://localhost:8501` in your browser.

---

## 📝 LinkedIn Post & Submission Checklist
- [x] Tested voice agent synthesis using Murf Falcon
- [x] Track declared out loud: **Farm & Field**
- [x] Recorded short demo video
- [x] Posted on LinkedIn with `#VoiceForBharat` and tagged `@Murf AI`
- [x] Submitted LinkedIn post link in Google Form
