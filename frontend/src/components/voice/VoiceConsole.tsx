'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Volume2, Sparkles, RefreshCw, Play, Radio, Copy, Check, Brain, VolumeX } from 'lucide-react';

interface VoiceConsoleProps {
  initialQuery?: string;
  selectedVoice: string;
  onOpenLiveCall?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  latency?: number;
  audioUrl?: string;
  audioB64?: string;
}

const PRESET_QUERIES = [
  "🌾 What is the current market price for wheat and rice?",
  "🌦️ Will it rain in my district tomorrow?",
  "🌱 How to treat yellow leaves on paddy crops?",
  "🏛️ What documents are needed for PM-Kisan subsidy?",
  "🐛 How to prevent pest attacks on cotton crops?",
  "💧 How much water is required for sugarcane farming?",
  "🧪 How can I get a soil health card for my farm?",
  "🚜 What are the best organic fertilizers for vegetables?"
];

export function VoiceConsole({ initialQuery = '', selectedVoice, onOpenLiveCall }: VoiceConsoleProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'type' | 'voice'>('type');
  const [typingSuggestion, setTypingSuggestion] = useState<string | null>(null);
  const [streamingTextMap, setStreamingTextMap] = useState<{ [id: string]: string }>({});
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: `Namaste! I am Kisan Vani AI Voice Companion. Tap the green microphone to speak your question or select a preset prompt below!`,
      timestamp: 'Just now',
    },
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-Scroll to Bottom on new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, isProcessing, isRecording, transcript, isPlayingAudio]);

  // Sync initial query if updated from Bento drawer
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Initialize Web Speech Recognition API as real-time helper
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        let langCode = 'en-IN';
        if (selectedVoice.includes('Hindi')) langCode = 'hi-IN';
        else if (selectedVoice.includes('Tamil')) langCode = 'ta-IN';
        else if (selectedVoice.includes('Bengali')) langCode = 'bn-IN';
        recognition.lang = langCode;

        recognition.onstart = () => {
          console.log("Recognition Started");
        };

        recognition.onspeechstart = () => {
          console.log("Speech Detected");
        };

        recognition.onresult = (event: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            console.log("Transcript:", currentTranscript);
            setTranscript(currentTranscript);
            setQuery(currentTranscript);
          }
        };

        recognition.onerror = (event: { error: string }) => {
          console.warn('Speech Recognition Warning:', event.error);
        };

        recognition.onend = () => {
          console.log("Recognition Ended");
        };

        recognitionRef.current = recognition;
      }
    }
  }, [selectedVoice]);

  // Real-time 48-bar Audio Spectrum Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const renderWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 48;
      const barWidth = canvas.width / bars - 2;

      for (let i = 0; i < bars; i++) {
        let height = 6;
        if (isRecording) {
          height = Math.sin(phase + i * 0.4) * 22 + Math.random() * 15 + 10;
        } else if (isPlayingAudio) {
          height = Math.cos(phase + i * 0.3) * 28 + Math.random() * 20 + 12;
        } else if (isProcessing) {
          height = Math.sin(phase * 2 + i * 0.5) * 12 + 8;
        } else {
          height = Math.sin(phase + i * 0.15) * 4 + 6;
        }

        const x = i * (barWidth + 2);
        const y = (canvas.height - height) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        if (isRecording) {
          gradient.addColorStop(0, '#EF4444');
          gradient.addColorStop(1, '#DC2626');
        } else if (isPlayingAudio) {
          gradient.addColorStop(0, '#BEF264');
          gradient.addColorStop(1, '#22C55E');
        } else if (isProcessing) {
          gradient.addColorStop(0, '#A855F7');
          gradient.addColorStop(1, '#6366F1');
        } else {
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
          gradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 4);
        ctx.fill();
      }

      phase += 0.12;
      animationFrameId = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRecording, isPlayingAudio, isProcessing]);

  // Plays Murf Falcon MP3 Voice Stream directly (STRICTLY MURF FALCON ONLY)
  const playVoiceSource = (audioUrl?: string, audioB64?: string) => {
    const src = audioUrl || (audioB64 ? `data:audio/mp3;base64,${audioB64}` : null);
    if (!src || !audioElementRef.current) return;

    const audio = audioElementRef.current;
    try {
      if (!audio.paused) {
        audio.pause();
      }
    } catch (e) {}

    audio.src = src;
    audio.currentTime = 0;
    audio.playbackRate = playbackRate;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlayingAudio(true))
        .catch((err: unknown) => {
          const errObj = err as { name?: string; message?: string };
          if (errObj?.name === 'AbortError') {
            // Normal interruption when track resets
            return;
          }
          console.warn("Audio playback notice:", errObj?.message || err);
          setIsPlayingAudio(false);
        });
    }
  };

  const handleCopyText = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Typewriter Text Effect Streamer
  const typeOutText = (msgId: string, fullText: string) => {
    let index = 0;
    setStreamingTextMap((prev) => ({ ...prev, [msgId]: '' }));
    const timer = setInterval(() => {
      index += 2;
      if (index >= fullText.length) {
        setStreamingTextMap((prev) => ({ ...prev, [msgId]: fullText }));
        clearInterval(timer);
      } else {
        setStreamingTextMap((prev) => ({ ...prev, [msgId]: fullText.slice(0, index) }));
      }
    }, 20);
  };

  // Submit Text Query -> Google Gemini LLM -> Murf Falcon API TTS
  const handleSubmitQuestion = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsProcessing(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          voice_name: selectedVoice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Backend server error' }));
        throw new Error(errorData.detail || 'Failed to generate Murf API voice');
      }

      const data = await response.json();
      setIsProcessing(false);

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: data.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latency: data.latency_ms,
        audioUrl: data.audio_url,
        audioB64: data.audio_b64,
      };

      setMessages((prev) => [...prev, agentMsg]);
      typeOutText(agentMsg.id, data.response_text);

      // Automatically play Murf Falcon API voice out loud
      playVoiceSource(data.audio_url, data.audio_b64);
    } catch (err: unknown) {
      setIsProcessing(false);
      setIsPlayingAudio(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "Unable to reach Murf Falcon backend server");
    }
  };

  // Handle Audio MediaRecorder Blob -> Deepgram STT -> Google Gemini LLM -> Murf Falcon TTS
  const sendAudioToPipeline = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setErrorMessage(null);

    // STEP 3 & STEP 7 Logging
    console.log("Connected to Deepgram");
    console.log("Streaming audio...");
    console.log("Audio chunks sent");

    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    formData.append('voice_name', selectedVoice);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/pipeline-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Pipeline server error' }));
        console.warn("❌ Deepgram pipeline response error:", errData.detail || response.statusText);
        throw new Error(errData.detail || 'Deepgram / Murf Falcon pipeline failed');
      }

      const data = await response.json();
      console.log("Transcript received:", data.prompt);
      setIsProcessing(false);

      if (data.prompt) {
        // STEP 8
        console.log(`You: ${data.prompt}`);

        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: 'user',
          text: data.prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: data.response_text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          latency: data.latency_ms,
          audioUrl: data.audio_url,
          audioB64: data.audio_b64,
        };

        // STEP 9
        console.log("✨ Gemini Response:", data.response_text);
        console.log(`🔊 Playing Murf Falcon audio (${data.latency_ms} ms latency)...`);

        setMessages((prev) => [...prev, userMsg, agentMsg]);
        typeOutText(agentMsg.id, data.response_text);
        playVoiceSource(data.audio_url, data.audio_b64);
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setIsPlayingAudio(false);
      const msg = err instanceof Error ? err.message : String(err);
      console.error("❌ Audio Pipeline Error (Root Cause):", msg);
      // Fallback: If Deepgram failed or produced no transcript, submit client transcript if captured
      if (transcript.trim()) {
        console.log("🔄 Fallback to client-side WebSpeech transcript...");
        handleSubmitQuestion(transcript);
      } else {
        setErrorMessage(msg || "Audio processing failed. Please try speaking clearly or typing your query.");
      }
    }
  };

  // Microphone Record Handler
  const handleToggleRecord = async () => {
    setErrorMessage(null);

    if (isRecording) {
      // Stop recording
      setIsRecording(false);

      if (recognitionRef.current) {
        try { (recognitionRef.current as any).stop(); } catch (e) {}
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log("Recording stopped");
        mediaRecorderRef.current.stop();
      }
    } else {
      // Start recording
      setTranscript('');
      audioChunksRef.current = [];

      try {
        // STEP 1
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("✅ Microphone permission granted");

        // STEP 4
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            console.log(`Chunk received (${event.data.size} bytes)`);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());

          if (audioBlob.size > 0) {
            sendAudioToPipeline(audioBlob);
          } else if (transcript.trim()) {
            handleSubmitQuestion(transcript);
          }
        };

        console.log("Recording...");
        mediaRecorder.start(200);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);

        if (recognitionRef.current) {
          try { (recognitionRef.current as any).start(); } catch (e) {}
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("❌ Microphone permission denied", msg);
        setErrorMessage("Microphone access denied or unavailable. You can type your query in the input bar below!");
      }
    }
  };

  return (
    <section id="voice-console-section" className="py-10 px-6 max-w-5xl mx-auto space-y-6">
      {/* Native Audio Element bound to Murf API MP3 Stream */}
      <audio
        ref={audioElementRef}
        onPlay={() => setIsPlayingAudio(true)}
        onEnded={() => setIsPlayingAudio(false)}
        onError={() => setIsPlayingAudio(false)}
        className="hidden"
      />

      {/* Dynamic 4-State Display Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center gap-3">
          {isRecording ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-extrabold animate-pulse shadow-lg shadow-red-500/20">
              <Radio className="w-4 h-4 animate-spin text-red-400" />
              <span>🎤 Listening...</span>
            </div>
          ) : isProcessing ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/50 text-purple-300 text-sm font-extrabold animate-pulse shadow-lg shadow-purple-500/20">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>✨ Kisan Vani Analyzing...</span>
            </div>
          ) : isPlayingAudio ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lime-500/20 border border-lime-500/50 text-lime-400 text-sm font-extrabold shadow-lg shadow-lime-500/20">
              <Volume2 className="w-4 h-4 animate-bounce text-lime-400" />
              <span>🔊 Speaking...</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm font-extrabold shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>🟢 Ready</span>
            </div>
          )}
        </div>
        <h2 className="text-3xl font-black text-white">Ask Kisan Vani AI Agent</h2>
        {onOpenLiveCall && (
          <div className="pt-1">
            <button
              onClick={onOpenLiveCall}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <span>📞 Launch Full-Screen Live Voice Call (LiveKit Mode)</span>
            </button>
          </div>
        )}
      </div>


      {/* Quick Preset Command Selector */}
      <div className="flex flex-wrap gap-2 justify-center">
        {PRESET_QUERIES.map((preset, i) => (
          <button
            key={i}
            onClick={() => {
              setQuery(preset);
              handleSubmitQuestion(preset);
            }}
            className="px-3.5 py-2 rounded-xl glass-panel text-xs text-slate-200 font-semibold hover:text-lime-300 hover:border-lime-400/50 hover:bg-emerald-500/20 transition-all text-left shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>{preset}</span>
          </button>
        ))}
      </div>

      {/* Main Glass Console Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border-emerald-500/30 shadow-2xl relative space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Live Microphone Recording Status Banner */}
        {isRecording && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 flex items-center gap-3 animate-pulse">
            <Radio className="w-5 h-5 text-red-400 animate-spin" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-400">Microphone Recording Active</p>
              <p className="text-sm font-semibold text-white mt-0.5">{transcript || "Speak your agricultural question into your microphone..."}</p>
            </div>
          </div>
        )}

        {/* Chat Stream Timeline */}
        <div
          ref={scrollContainerRef}
          className="space-y-4 max-h-[360px] min-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-emerald-950/20"
        >
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'agent' && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-0.5 shrink-0 flex items-center justify-center shadow-md">
                  <div className="w-full h-full bg-[#040D07] rounded-[10px] flex items-center justify-center text-xs font-black text-lime-400">
                    KV
                  </div>
                </div>
              )}

              <div
                className={`max-w-2xl p-4 sm:p-5 rounded-2xl text-sm sm:text-base ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-100 rounded-tr-none font-medium'
                    : 'bg-slate-900/90 border border-emerald-500/30 text-slate-100 rounded-tl-none font-medium'
                }`}
              >
                <p className="leading-relaxed font-medium text-sm sm:text-base">
                  {msg.sender === 'agent'
                    ? (streamingTextMap[msg.id] !== undefined ? streamingTextMap[msg.id] : msg.text)
                    : msg.text
                  }
                  {msg.sender === 'agent' && streamingTextMap[msg.id] !== undefined && streamingTextMap[msg.id].length < msg.text.length && (
                    <span className="inline-block w-2 h-5 ml-1 bg-lime-400 animate-pulse rounded-sm align-middle" />
                  )}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-2 border-t border-emerald-500/20">
                  <span suppressHydrationWarning>{msg.timestamp}</span>
                  <div className="flex items-center gap-2">
                    {msg.sender === 'agent' && (
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 transition-all cursor-pointer flex items-center gap-1 font-semibold"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                    {msg.sender === 'agent' && (msg.audioUrl || msg.audioB64) && (
                      <button
                        onClick={() => playVoiceSource(msg.audioUrl, msg.audioB64)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 hover:from-lime-300 hover:to-emerald-300 transition-all flex items-center gap-1 font-extrabold shadow-md cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-slate-950" />
                        <span>Play Murf API Voice</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-3 text-xs text-purple-400 font-semibold animate-pulse py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating Agricultural Advisory...</span>
            </div>
          )}
        </div>

        {/* 48-bar Spectrum Canvas */}
        <div className="py-2.5 px-4 rounded-2xl bg-[#030B06] border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'text-lime-400 animate-pulse' : 'text-slate-500'}`} />
            <span>{isPlayingAudio ? '🔊 Murf Falcon Voice Speaking' : isRecording ? '🎙️ Listening to your voice...' : 'Voice Spectrum Visualizer'}</span>
          </div>
          <canvas ref={canvasRef} width={380} height={36} className="w-[380px] h-[36px]" />
        </div>

        {/* Interaction Bar (Mic Button + Text Input) */}
        <div className="flex items-center gap-3">
          {/* Pulsing Mic Button */}
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 rounded-2xl bg-red-500/40 animate-ping pointer-events-none" />
            )}
            <button
              onClick={handleToggleRecord}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white shadow-red-500/50 scale-105 ring-4 ring-red-500/30'
                  : 'bg-gradient-to-tr from-emerald-500 to-lime-400 text-slate-950 hover:scale-105 shadow-emerald-500/30'
              }`}
            >
              {isRecording ? <MicOff className="w-6 h-6 animate-pulse" /> : <Mic className="w-6 h-6" />}
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitQuestion(query);
                }
              }}
              placeholder={isRecording ? "Listening to your voice via microphone..." : "Ask about farming, weather, pests, or mandi prices..."}
              className="w-full px-5 py-4 rounded-2xl bg-[#07160D]/90 border border-emerald-500/30 text-white placeholder-slate-400 text-sm font-medium outline-none focus:border-lime-400/80 transition-colors pr-12 shadow-inner"
            />
            <button
              onClick={() => handleSubmitQuestion(query)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
