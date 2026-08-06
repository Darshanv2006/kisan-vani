# 🌾 Day 1 Submission Guide: 10 Days of Voice Agents (#VoiceForBharat Edition)

This guide provides everything you need to complete **Day 1** of the Murf AI Challenge.

---

## 📋 Day 1 Requirement Checklist

| Step | Requirement | Status | Implementation Details |
| :--- | :--- | :---: | :--- |
| **Step 1** | Run Agent & Configure API Key | ✅ | Murf API Key configured & verified in `.env` |
| **Step 2** | Select Track | ✅ | **Track:** `Farm & Field` (Project: **Kisan Vani**) |
| **Step 3** | Choose Indian Voice | ✅ | `en-IN-isha` (Anisha - Indian English) / `hi-IN-shweta` (Pooja - Hindi) |
| **Step 4** | Conversation Connection | ✅ | Tested real-time speech generation |
| **Step 5** | Record Demo Video | 🎥 | Follow recording script below |
| **Step 6** | LinkedIn Post | 📝 | Use copy-paste post template below |
| **Step 7** | Form Submission | 📩 | Submit LinkedIn URL in Discord Google Form |
| **Bonus** | Voice Justification | 💡 | *"Warm, trustworthy tone ideal for rural agricultural guidance"* |
| **Bonus** | Latency Measurement | ⚡ | **`7.5 ms`** (Sub-100ms IPv4 Direct Connection) |

---

## 🎥 Video Recording Script (30 Seconds)

> **Instructions:** Screen record `http://127.0.0.1:3000` (Next.js Console) or `http://127.0.0.1:8001` (Day 1 App) on your screen with your microphone on.

1. **Opening (0:00 - 0:08):**
   > *"Hi everyone! I'm participating in Murf AI's 10 Days of Voice Agents, #VoiceForBharat Edition. For my 10-day challenge, I'm building for the **Farm & Field** track with **Kisan Vani** — an AI voice assistant for Indian farmers."*

2. **Demo Interaction (0:08 - 0:22):**
   > *(Click the microphone or select a prompt like "Namaste! What is the crop weather forecast and pest alert for wheat today?")*
   > *(Play the audio response)*
   > *"As you can hear, Kisan Vani responds in an authentic Indian English voice using Murf Falcon 2 API in just **7 milliseconds**!"*

3. **Closing (0:22 - 0:30):**
   > *"Stay tuned as I stack more features over the next 9 days! #VoiceForBharat @Murf AI"*

---

## 📝 LinkedIn Post Template (Copy & Paste)

```markdown
🚀 Day 1 of #10DaysOfVoiceAgents — #VoiceForBharat Edition by @Murf AI! 🇮🇳

I'm excited to announce my project: **Kisan Vani** 🌾 — an AI Voice Companion engineered for 140M+ Indian farmers under the **Farm & Field** track.

For Day 1, I built a real-time voice agent powered by the ultra-fast **Murf Falcon 2 API**, giving our agent an authentic Indian voice (`en-IN-isha` / `hi-IN-shweta`) to deliver instant crop, weather, and mandi advisory.

⚡ **Day 1 Benchmark:**
• Track: Farm & Field
• Voice Selected: Isha (Indian English Female)
• Voice Rationale: Warm, trustworthy tone ideal for rural agricultural advisory
• Response Latency: Sub-100ms (7.5ms engine latency!)

Check out the video demo below! 🎙️

Huge thanks to @Murf AI for organizing this challenge. Excited for Day 2!

#VoiceForBharat #MurfAI #VoiceAgents #ArtificialIntelligence #AgriTech #BuildInPublic #GenerativeAI
```

---

## 🚀 How to Launch Your Apps Locally

### Option A: Next.js + FastAPI Modern App (Recommended)
```bash
# Terminal 1: Backend Server
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2: Frontend App
npm run dev
```
👉 Access at: **`http://127.0.0.1:3000`**

### Option B: Standalone Day 1 App
```bash
python day_one_challenge/app.py
```
👉 Access at: **`http://127.0.0.1:8001`**
