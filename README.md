# Kisan Vani 🌾🔊

> **Real-Time AI Voice Assistant for Agriculture & Farming Advisory**

Kisan Vani is a production-grade, low-latency conversational AI voice assistant tailored for farmers and agricultural communities. Built on **LiveKit WebRTC**, **Deepgram Speech-to-Text**, **Google Gemini 2.5 Flash / Groq LLM**, and **Murf Falcon Text-to-Speech**, Kisan Vani delivers sub-second voice interaction to provide real-time crop disease diagnosis, weather updates, government scheme info, and market mandi prices.

---

## 🌟 Key Features

- **Real-Time WebRTC Audio Pipeline**: Low-latency voice streaming using LiveKit.
- **Accurate Multilingual Speech-to-Text**: Deepgram `nova-2` STT engine with automatic language detection (English, Hindi, Hinglish).
- **Domain-Specific Agriculture LLM**: Google Gemini 2.5 Flash & Groq Fast-Inference LLM with 0ms fast-path knowledge lookup for schemes & prices.
- **Natural Voice Synthesis**: High-fidelity speech response powered exclusively by Murf Falcon TTS.
- **Conversational State Machine**: 4-phase state management (`Connecting` → `Speaking` → `Listening` → `Thinking` → `Speaking`).
- **Interactive Modern UI**: Sleek glassmorphic interface with audio visualizer, camera toggle, and fallback text chat.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: Next.js 16 (Turbopack, React 19)
- **Styling**: Tailwind CSS & Glassmorphism Design System
- **Real-Time Transport**: LiveKit Client SDK (`livekit-client`)
- **Animations**: Framer Motion & Lucide Icons

### **Backend**
- **API Server**: FastAPI (Python 3.10+) & Uvicorn
- **Speech-to-Text**: Deepgram REST API (`nova-2` model)
- **Intelligence Engine**: Google Gemini 2.5 Flash API / Groq Llama 3
- **Text-to-Speech**: Murf Falcon TTS API
- **Transport**: LiveKit WebRTC Token Service

---

## 🏗️ Architecture Diagram

```
[ User Microphone ]
        │
        ▼ (LiveKit WebRTC / PCM Stream)
[ Frontend (Next.js 16) ]
        │
        ▼ (HTTP / WebSockets)
[ FastAPI Backend Engine ]
        │
        ├─► [ 1. Deepgram STT (nova-2) ] ──────► User Speech Transcript
        │
        ├─► [ 2. Gemini 2.5 Flash / Groq ] ────► Agri Advisory Answer
        │
        └─► [ 3. Murf Falcon TTS ] ────────────► High-Fidelity Audio Synthesis
        │
        ▼
[ Audio Response Streamed to User ]
```

---

## 📂 Folder Structure

```
.
├── backend/
│   ├── main.py              # FastAPI server & pipeline endpoint orchestrator
│   ├── stt_engine.py        # Deepgram Speech-to-Text integration
│   ├── llm_engine.py        # Gemini 2.5 Flash & Groq agricultural LLM engine
│   ├── murf_falcon.py       # Murf Falcon TTS integration & voice caching
│   ├── requirements.txt     # Python backend dependencies
│   └── .env.example         # Backend environment configuration template
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router & API routes (/api/token)
│   │   └── components/
│   │       └── voice/
│   │           └── LiveKitVoiceCall.tsx # Real-time voice UI & state machine
│   ├── package.json         # Frontend dependencies
│   └── next.config.ts       # Next.js configuration
├── .gitignore               # Ignored build & environment files
└── README.md                # Project documentation
```

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend/` directory based on `.env.example`:

```env
# Murf Falcon TTS
MURF_API_KEY=your_murf_api_key_here

# LiveKit WebRTC Cloud
LIVEKIT_URL=wss://your-livekit-domain.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here

# Deepgram Speech-to-Text
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# LLM Providers
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_API_KEY=your_google_gemini_api_key_here
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js**: v18+
- **Python**: 3.10+
- **npm** or **pnpm**

### 1. Clone the Repository
```bash
git clone https://github.com/Darshanv2006/kisan-vani.git
cd kisan-vani
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start using Kisan Vani!

---

## 🎙️ Day 2 Challenge Updates - Murf Falcon Voice Pipeline

- **Persona**: Kisan Vani (Friendly, knowledgeable Indian agricultural advisory persona).
- **Voice Engine**: Murf Falcon TTS (`en-IN-pooja` voice, `Conversational` style).
- **Auto-Greeting**: Automated intro script delivered seamlessly upon LiveKit WebRTC room connection with 2-second natural pause gaps.
- **LLM Engine**: Ultra-low-latency Groq (`llama-3.1-8b-instant`) / Gemini Flash fallback for sub-500ms response cycles.

---

## 🔮 Future Improvements

- [ ] Support for regional Indian dialects (Kannada, Telugu, Marathi, Punjabi, Tamil).
- [ ] Multimodal crop leaf disease scanning via camera upload.
- [ ] Offline audio caching for low-bandwidth rural connectivity.
- [ ] Integration with national mandi price APIs for live crop price updates.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

