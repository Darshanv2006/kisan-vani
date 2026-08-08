# Day 3 – Kisan Vani (AI Agricultural Voice Assistant)

Welcome to **Day 3** of the **Kisan Vani** voice AI project built for the **#VoiceForBharat** initiative. Day 3 expands Kisan Vani into a ultra-low latency, real-time conversational voice assistant using the **LiveKit Agents** framework paired with **Murf Falcon TTS** and **Deepgram STT**.

---

## 🌟 Overview & Key Features

Kisan Vani is designed to empower farmers across Bharat by providing instant, natural, and accessible voice-based agricultural assistance.

### Key Technical Highlights:
- **Real-time Voice Interaction**: Ultra-low latency voice streaming built on LiveKit WebRTC infrastructure.
- **Murf AI Voice Integration**: High-fidelity, natural text-to-speech rendering powered by **Murf Falcon TTS** streaming engine.
- **Deepgram STT Integration**: High-accuracy Speech-to-Text (STT) handling agricultural terminology and multilingual inputs.
- **Agriculture-Focused Assistance**: Gemini-powered LLM engine equipped with real-time decision support tools (e.g., weather analysis, crop disease advisory, market price lookup).
- **Interactive UI Console**: Next.js + React modern visualizer UI displaying live audio waveforms, real-time chat transcripts, and session telemetry.

---

## 🏗️ Architecture & Technology Stack

```
[ Farmer Voice Input ] ──(WebRTC)──► [ LiveKit Server ]
                                          │
                                          ▼
                                   [ Python Agent Worker ]
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
           [ Deepgram STT ]       [ Google Gemini LLM ]    [ Murf Falcon TTS ]
           (Speech to Text)       (Decision & Tool Use)   (Streaming Synthesis)
                                          │
                                          ▼
[ Farmer Audio Output ] ◄─(WebRTC)─── [ LiveKit Server ]
```

### Components:
1. **Backend (`/backend`)**:
   - Python LiveKit Agent worker (`src/agent.py`) using `livekit-agents` and `livekit-plugins-murf`.
   - Tool calling integration for agricultural queries (e.g., weather, crop advisory).
   - Voice pipeline management with Silero VAD (Voice Activity Detection).

2. **Frontend (`/frontend`)**:
   - Next.js application built with TypeScript and Tailwind CSS.
   - LiveKit Agents UI components for real-time waveform visualizers, connection state management, and transcript logging.
   - Secure token API route (`/api/token`) for WebRTC authentication.

---

## 📺 Demonstration & Capabilities

The Day 3 implementation demonstrates:
1. **Instant Voice Connectivity**: One-click connection establishing a full-duplex WebRTC audio session.
2. **Natural Voice Synthesis**: Fluid response delivery using Murf Falcon streaming voice TTS.
3. **Agricultural Advisory**: Answering queries regarding crop planting, soil care, weather updates, and market trends.
4. **Resilient Handling**: Turn detection and noise-filtering VAD ensuring smooth back-and-forth conversation.

---

## 🚀 Running Day 3 Locally

### Prerequisites
- Python 3.10+ & `uv` package manager
- Node.js 18+ & `pnpm`
- LiveKit Cloud or local LiveKit Server credentials
- API keys: Murf AI, Deepgram, Google Gemini

### Setup & Launch

1. **Backend**:
   ```bash
   cd DAY\ 3/backend
   uv sync
   cp .env.example .env.local  # Fill in your API keys
   uv run python src/agent.py dev
   ```

2. **Frontend**:
   ```bash
   cd DAY\ 3/frontend
   pnpm install
   cp .env.example .env.local  # Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
   pnpm dev
   ```

3. Open `http://localhost:3000` to interact with Kisan Vani!

---

*Part of the #VoiceForBharat Challenge — Empowering Agriculture through Conversational Voice AI.*
