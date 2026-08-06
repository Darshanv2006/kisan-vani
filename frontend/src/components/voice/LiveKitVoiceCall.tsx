'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Room, RoomEvent, createLocalAudioTrack, LocalAudioTrack } from 'livekit-client';
import { Mic, Video, VideoOff, MessageSquare, PhoneOff, X, Send } from 'lucide-react';

interface LiveKitVoiceCallProps {
  selectedVoice: string;
  onClose?: () => void;
}

interface CallMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

type CallState = 'connecting' | 'listening' | 'thinking' | 'speaking';

export function LiveKitVoiceCall({ selectedVoice, onClose }: LiveKitVoiceCallProps) {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [inputText, setInputText] = useState('');
  const [latestResponse, setLatestResponse] = useState<string>(
    'Namaste! Welcome to Kisan Vani. How can I help you today?'
  );
  const [messages, setMessages] = useState<CallMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Namaste! Kisan Vani voice assistant ready. Ask any question about crops, weather, or mandi prices.',
      timestamp: 'Just now',
    },
  ]);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Play Murf Falcon Audio Response
  const playMurfAudio = (audioUrl?: string, audioB64?: string) => {
    const src = audioUrl || (audioB64 ? `data:audio/mp3;base64,${audioB64}` : null);
    if (!src) {
      setCallState('listening');
      return;
    }

    let audio = audioElementRef.current;
    if (!audio) {
      audio = new Audio();
      audioElementRef.current = audio;
    }

    try {
      if (!audio.paused) audio.pause();
    } catch (e) {}

    audio.src = src;
    audio.currentTime = 0;

    audio.onended = () => {
      setCallState('listening');
    };

    audio.onerror = () => {
      setCallState('listening');
    };

    setCallState('speaking');
    audio.play().catch((err) => {
      console.warn("Autoplay note:", err);
      setCallState('listening');
    });
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);

  // Full Voice Pipeline: Mic Audio -> Deepgram STT -> Gemini LLM -> Murf Falcon TTS
  const processVoicePipeline = async (audioBlob: Blob, manualText?: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setCallState('thinking');

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'voice.webm');
      formData.append('voice_name', selectedVoice);
      if (manualText) {
        formData.append('captured_text', manualText);
      }

      const res = await fetch('http://127.0.0.1:8000/api/pipeline-audio', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.prompt) {
          setLatestResponse(data.response_text);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender: 'user',
              text: data.prompt,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
              id: (Date.now() + 1).toString(),
              sender: 'agent',
              text: data.response_text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          isProcessingRef.current = false;
          playMurfAudio(data.audio_url, data.audio_b64);
          return;
        } else if (data.response_text && data.success) {
          setLatestResponse(data.response_text);
          isProcessingRef.current = false;
          playMurfAudio(data.audio_url, data.audio_b64);
          return;
        }
      }
    } catch (err) {
      console.warn("Pipeline error:", err);
    }
    isProcessingRef.current = false;
    setCallState('listening');
  };

  // 1. Play Murf Falcon Welcome Greeting
  const triggerWelcomeMessage = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: "welcome",
          voice_name: selectedVoice,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLatestResponse(data.response_text);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'agent',
            text: data.response_text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        playMurfAudio(data.audio_url, data.audio_b64);
      } else {
        setCallState('listening');
      }
    } catch (err) {
      setCallState('listening');
    }
  };

  // 2. Connect to LiveKit Room & Publish Microphone Track
  useEffect(() => {
    let isSubscribed = true;
    let room: Room | null = null;

    async function initLiveKit() {
      setCallState('connecting');
      try {
        const res = await fetch('/api/token', { method: 'POST' });
        if (res.ok) {
          const { serverUrl, participantToken } = await res.json();
          if (serverUrl && participantToken && isSubscribed) {
            room = new Room({ adaptiveStream: true, dynacast: true });
            livekitRoomRef.current = room;

            room.on(RoomEvent.Connected, async () => {
              if (isSubscribed) {
                console.log("🟢 Connected to LiveKit Room");
                try {
                  const audioTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
                  localAudioTrackRef.current = audioTrack;
                  if (room && room.localParticipant) {
                    await room.localParticipant.publishTrack(audioTrack);
                    console.log("🎙️ Published Microphone Track via LiveKit");
                  }
                } catch (trErr) {
                  console.warn("LiveKit Audio Track Notice:", trErr);
                }
              }
            });

            await room.connect(serverUrl, participantToken);
          }
        }
      } catch (e) {
        console.warn("LiveKit Room Notice:", e);
      }

      if (isSubscribed) {
        triggerWelcomeMessage();
      }
    }

    initLiveKit();

    return () => {
      isSubscribed = false;
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
      }
      if (livekitRoomRef.current) {
        try { livekitRoomRef.current.disconnect(); } catch (e) {}
      }
    };
  }, []);

  // Listen for speech when in listening state
  useEffect(() => {
    if (callState !== 'listening' || isProcessingRef.current) return;

    let recorder: MediaRecorder | null = null;
    let timeoutId: NodeJS.Timeout;
    let micStream: MediaStream | null = null;

    async function startRecording() {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

        recorder = new MediaRecorder(micStream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          audioChunksRef.current = [];
          if (micStream) {
            micStream.getTracks().forEach((t) => t.stop());
          }
          if (audioBlob.size > 800 && !isProcessingRef.current) {
            await processVoicePipeline(audioBlob);
          }
        };

        recorder.start(250);

        timeoutId = setTimeout(() => {
          if (recorder && recorder.state === 'recording') {
            recorder.stop();
          }
        }, 1200);
      } catch (e) {
        console.warn("Mic capture note:", e);
      }
    }

    startRecording();

    return () => {
      clearTimeout(timeoutId);
      if (recorder && recorder.state === 'recording') {
        try { recorder.stop(); } catch (e) {}
      }
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [callState]);

  // Send Text Question directly to backend
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');
    setCallState('thinking');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, voice_name: selectedVoice }),
      });

      if (res.ok) {
        const data = await res.json();
        setLatestResponse(data.response_text);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'user',
            text: userText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: data.response_text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        playMurfAudio(data.audio_url, data.audio_b64);
      } else {
        setCallState('listening');
      }
    } catch (err) {
      setCallState('listening');
    }
  };

  // Camera Toggle
  const toggleCamera = async () => {
    if (isVideoOn) {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      setIsVideoOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsVideoOn(true);
      } catch (e) {
        console.warn("Camera note:", e);
      }
    }
  };

  // End Call
  const endCall = () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (livekitRoomRef.current) {
      try { livekitRoomRef.current.disconnect(); } catch (e) {}
    }
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020704]/98 backdrop-blur-3xl text-slate-100 flex flex-col justify-between p-6 overflow-hidden select-none font-sans">
      <audio ref={audioElementRef} className="hidden" />

      {/* Header */}
      <header className="flex items-center justify-between w-full max-w-7xl mx-auto z-20 pt-2 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#040D07] rounded-[10px] flex items-center justify-center font-black text-lime-400 text-sm">
              KV
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Kisan <span className="text-gradient">Vani</span>
            </span>
            <p className="text-xs text-slate-400 font-medium">Real-Time Voice Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
          <span className="px-3 py-1.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm">
            Voice: {selectedVoice}
          </span>
          {onClose && (
            <button
              onClick={endCall}
              className="p-2.5 rounded-full bg-slate-900/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 transition-colors text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Visualizer Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-4xl mx-auto z-10 my-auto">
        <div className="mb-6">
          <div className="px-5 py-2 rounded-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-black shadow-xl backdrop-blur-md flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                callState === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : callState === 'speaking'
                  ? 'bg-emerald-400 animate-ping'
                  : callState === 'listening'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-purple-400 animate-spin'
              }`}
            />
            <span className="capitalize">
              {callState === 'connecting'
                ? '🟡 Connecting...'
                : callState === 'speaking'
                ? '🔊 Speaking...'
                : callState === 'listening'
                ? '🟢 Listening...'
                : '🧠 Thinking...'}
            </span>
          </div>
        </div>

        {/* Wave Animation */}
        <div className="flex flex-col items-center justify-center space-y-6 w-full">
          <div className="flex items-center justify-center gap-3 sm:gap-4 h-36">
            <motion.div
              animate={{
                height: callState === 'speaking' ? [20, 68, 24, 52, 20] : callState === 'listening' ? [14, 48, 20, 36, 14] : [12, 16, 12],
              }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
              className="w-3 sm:w-4 rounded-full bg-gradient-to-t from-emerald-600 via-lime-400 to-emerald-300 shadow-lg"
            />
            <motion.div
              animate={{
                height: callState === 'speaking' ? [30, 96, 40, 80, 30] : callState === 'listening' ? [20, 72, 30, 60, 20] : [16, 24, 16],
              }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut', delay: 0.1 }}
              className="w-3 sm:w-4 rounded-full bg-gradient-to-t from-emerald-500 via-lime-300 to-emerald-200 shadow-lg"
            />
            <motion.div
              animate={{
                height: callState === 'speaking' ? [40, 120, 60, 110, 40] : callState === 'listening' ? [28, 90, 40, 80, 28] : [20, 32, 20],
              }}
              transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut', delay: 0.2 }}
              className="w-4 sm:w-5 rounded-full bg-gradient-to-t from-lime-500 via-emerald-400 to-lime-200 shadow-xl"
            />
            <motion.div
              animate={{
                height: callState === 'speaking' ? [30, 96, 40, 80, 30] : callState === 'listening' ? [20, 72, 30, 60, 20] : [16, 24, 16],
              }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut', delay: 0.3 }}
              className="w-3 sm:w-4 rounded-full bg-gradient-to-t from-emerald-500 via-lime-300 to-emerald-200 shadow-lg"
            />
            <motion.div
              animate={{
                height: callState === 'speaking' ? [20, 68, 24, 52, 20] : callState === 'listening' ? [14, 48, 20, 36, 14] : [12, 16, 12],
              }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut', delay: 0.4 }}
              className="w-3 sm:w-4 rounded-full bg-gradient-to-t from-emerald-600 via-lime-400 to-emerald-300 shadow-lg"
            />
          </div>

          <motion.div
            key={latestResponse}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-center"
          >
            <p className="text-sm sm:text-base font-semibold text-slate-200 leading-relaxed italic">
              &quot;{latestResponse}&quot;
            </p>
          </motion.div>

          {isVideoOn && (
            <div className="w-48 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-black mt-4">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="w-full max-w-md mx-auto z-20 pb-4">
        <div className="flex items-center justify-center gap-4 bg-slate-900/90 border border-emerald-500/30 rounded-full p-2.5 shadow-2xl backdrop-blur-2xl">
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-all transform active:scale-90 cursor-pointer ${
              isVideoOn ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={isVideoOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-4 rounded-full transition-all transform active:scale-90 cursor-pointer ${
              showChat ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle Chat"
          >
            <MessageSquare className="w-6 h-6" />
          </button>

          <button
            onClick={endCall}
            className="px-6 py-4 rounded-full bg-gradient-to-r from-rose-600 to-red-500 text-white font-extrabold shadow-lg hover:from-rose-500 hover:to-red-400 transition-all transform active:scale-95 flex items-center gap-2 cursor-pointer text-sm"
          >
            <PhoneOff className="w-5 h-5" />
            <span>END CALL</span>
          </button>
        </div>
      </footer>

      {/* Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-6 right-6 bottom-6 w-96 z-[210] bg-slate-950/95 border border-emerald-500/40 rounded-3xl p-5 shadow-2xl backdrop-blur-3xl flex flex-col justify-between"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-lime-400 text-base">Live Chat</h3>
              <button onClick={() => setShowChat(false)} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl max-w-[85%] ${
                    m.sender === 'user'
                      ? 'ml-auto bg-emerald-600 text-white rounded-br-none'
                      : 'mr-auto bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="font-medium leading-relaxed">{m.text}</p>
                  <span className="text-[10px] opacity-60 block text-right mt-1">{m.timestamp}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendText} className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type question..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button type="submit" className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
