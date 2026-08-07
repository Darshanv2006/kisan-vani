'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { Phone, PhoneOff } from 'lucide-react';

interface TokenResponse {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

type CallState = 'connecting' | 'listening' | 'speaking' | 'ended';

export function LiveKitVoiceCall() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [connData, setConnData] = useState<TokenResponse | null>(null);
  const [callState, setCallState] = useState<CallState>('ended');
  const [spokenText, setSpokenText] = useState<string>('');

  // Trigger LiveKit Token generation and start call
  const startCall = async () => {
    setIsCallActive(true);
    setCallState('connecting');
    setSpokenText('');
    try {
      const res = await fetch('/api/token', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setConnData(data);
      } else {
        setCallState('ended');
        setIsCallActive(false);
      }
    } catch (err) {
      console.error("Token error:", err);
      setCallState('ended');
      setIsCallActive(false);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setConnData(null);
    setCallState('ended');
    setSpokenText('');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#010804] text-slate-100 flex flex-col justify-between p-8 overflow-hidden select-none font-sans">
      
      {/* Top Header */}
      <header className="flex items-center justify-between w-full max-w-5xl mx-auto z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-[#020C06] rounded-[10px] flex items-center justify-center font-black text-lime-400 text-sm">
              KV
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Kisan <span className="text-lime-400">Vani</span>
            </span>
            <p className="text-xs text-slate-400 font-medium">Real-Time WebRTC Voice Assistant</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Agent: Pooja (Murf AI)
        </div>
      </header>

      {/* Main Calling Screen Interface */}
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-2xl mx-auto z-10">
        
        {/* Connection/Status Badge */}
        <div className="mb-8">
          <div className="px-5 py-2.5 rounded-full bg-slate-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-black shadow-xl backdrop-blur-md flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                callState === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : callState === 'speaking'
                  ? 'bg-emerald-400 animate-ping'
                  : callState === 'listening'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {callState === 'connecting' && '🟡 Connecting Call...'}
              {callState === 'listening' && '🟢 Listening... Ask anything'}
              {callState === 'speaking' && '🔊 Pooja (Murf AI) is speaking...'}
              {callState === 'ended' && '⏹️ Call Offline'}
            </span>
          </div>
        </div>

        {/* LiveKit Real-Time WebRTC Audio Room */}
        {isCallActive && connData && (
          <LiveKitRoom
            serverUrl={connData.serverUrl}
            token={connData.participantToken}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={endCall}
            className="flex flex-col items-center justify-center w-full"
          >
            <RoomAudioRenderer />
            <CallEventWrapper 
              setCallState={setCallState} 
              callState={callState}
              spokenText={spokenText}
              setSpokenText={setSpokenText}
            />
          </LiveKitRoom>
        )}

        {/* Static Placeholder for offline state */}
        {(!isCallActive || !connData) && (
          <div className="flex flex-col items-center justify-center space-y-12">
            <div className="flex items-center justify-center gap-3 h-24 opacity-30">
              <div className="w-3 h-10 rounded-full bg-emerald-600" />
              <div className="w-3 h-16 rounded-full bg-emerald-500" />
              <div className="w-4 h-20 rounded-full bg-lime-500" />
              <div className="w-3 h-16 rounded-full bg-emerald-500" />
              <div className="w-3 h-10 rounded-full bg-emerald-600" />
            </div>
            <div className="text-center max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <p className="text-sm font-semibold text-slate-400 leading-relaxed">
                Connect to speak with Pooja, your dedicated agricultural advisory voice assistant.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Dial Controls */}
      <footer className="w-full max-w-xs mx-auto z-20 pb-6">
        <div className="flex justify-center">
          {isCallActive ? (
            <button
              onClick={endCall}
              className="w-full py-4 rounded-full bg-gradient-to-r from-rose-600 to-red-500 text-white font-extrabold shadow-lg hover:from-rose-500 hover:to-red-400 transition-all transform active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-sm tracking-wider"
            >
              <PhoneOff className="w-5 h-5" />
              <span>END CALL</span>
            </button>
          ) : (
            <button
              onClick={startCall}
              className="w-full py-4 rounded-full bg-gradient-to-r from-emerald-600 via-lime-500 to-emerald-400 text-slate-950 font-extrabold shadow-lg hover:from-emerald-500 hover:to-lime-400 transition-all transform active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-sm tracking-wider animate-pulse"
            >
              <Phone className="w-5 h-5" />
              <span>START CALL</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

interface CallEventWrapperProps {
  setCallState: (state: CallState) => void;
  callState: CallState;
  spokenText: string;
  setSpokenText: (txt: string) => void;
}

// Inner wrapper component that has access to LiveKit hooks
function CallEventWrapper({ setCallState, callState, spokenText, setSpokenText }: CallEventWrapperProps) {
  const activeRoom = useRoomContext();
  const [micVolume, setMicVolume] = useState(0);

  // Monitor speaking status of remote agent and enable microphone safely on room connection
  useEffect(() => {
    if (!activeRoom) return;

    let silenceTimer: NodeJS.Timeout | null = null;

    const enableMicAndListen = async () => {
      try {
        if (activeRoom.state === 'connected') {
          await activeRoom.localParticipant.setMicrophoneEnabled(true);
        } else {
          activeRoom.once(RoomEvent.Connected, async () => {
            await activeRoom.localParticipant.setMicrophoneEnabled(true);
          });
        }
      } catch (e) {
        console.warn("Enable mic warning:", e);
      }
      setCallState('speaking');
    };

    enableMicAndListen();

    const handleActiveSpeakers = (speakers: any[]) => {
      const isAgentSpeaking = speakers.some((s) => !s.isLocal);
      if (isAgentSpeaking) {
        if (silenceTimer) clearTimeout(silenceTimer);
        setCallState('speaking');
      } else {
        // Debounce switching to 'listening' so brief 2-second gaps stay visually in 'speaking' mode
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          setCallState('listening');
        }, 2800);
      }
    };

    // Listen to transcripts published by LiveKit agent
    const handleTranscription = (transcriptions: any[]) => {
      if (transcriptions && transcriptions.length > 0) {
        const latest = transcriptions[transcriptions.length - 1];
        if (latest.text) {
          const cleaned = latest.text.replace(/\.\.\./g, '').trim();
          if (cleaned) {
            setSpokenText(cleaned);
          }
        }
      }
    };

    activeRoom.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    activeRoom.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      activeRoom.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      activeRoom.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [activeRoom, setCallState, setSpokenText]);

  // Compute live microphone input level for bouncing visualizer waves
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let animationId: number;

    async function setupMicrophoneVolume() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioCtxClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const update = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(1, Math.max(0, (average - 2) / 30));
          setMicVolume(normalized);
          animationId = requestAnimationFrame(update);
        };
        
        update();
      } catch (err) {
        console.warn("Visualizer mic access note:", err);
      }
    }

    setupMicrophoneVolume();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-12 w-full mt-6">
      {/* Premium Bouncing Waves */}
      <div className="flex items-center justify-center gap-3.5 h-36">
        <motion.div
          animate={{
            height: callState === 'speaking' ? [25, 75, 30, 60, 25] : callState === 'listening' ? Math.max(16, Math.min(100, 16 + micVolume * 70)) : 12,
          }}
          transition={callState === 'speaking' ? { repeat: Infinity, duration: 0.8, ease: 'easeInOut' } : { duration: 0.1 }}
          className="w-3.5 rounded-full bg-gradient-to-t from-emerald-600 via-lime-400 to-emerald-300 shadow-lg"
        />
        <motion.div
          animate={{
            height: callState === 'speaking' ? [35, 105, 45, 90, 35] : callState === 'listening' ? Math.max(20, Math.min(115, 20 + micVolume * 90)) : 16,
          }}
          transition={callState === 'speaking' ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut', delay: 0.1 } : { duration: 0.1 }}
          className="w-3.5 rounded-full bg-gradient-to-t from-emerald-500 via-lime-300 to-emerald-200 shadow-lg"
        />
        <motion.div
          animate={{
            height: callState === 'speaking' ? [45, 130, 65, 120, 45] : callState === 'listening' ? Math.max(24, Math.min(130, 24 + micVolume * 110)) : 20,
          }}
          transition={callState === 'speaking' ? { repeat: Infinity, duration: 0.6, ease: 'easeInOut', delay: 0.2 } : { duration: 0.1 }}
          className="w-4 rounded-full bg-gradient-to-t from-lime-500 via-emerald-400 to-lime-200 shadow-xl"
        />
        <motion.div
          animate={{
            height: callState === 'speaking' ? [35, 105, 45, 90, 35] : callState === 'listening' ? Math.max(20, Math.min(115, 20 + micVolume * 90)) : 16,
          }}
          transition={callState === 'speaking' ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut', delay: 0.3 } : { duration: 0.1 }}
          className="w-3.5 rounded-full bg-gradient-to-t from-emerald-500 via-lime-300 to-emerald-200 shadow-lg"
        />
        <motion.div
          animate={{
            height: callState === 'speaking' ? [25, 75, 30, 60, 25] : callState === 'listening' ? Math.max(16, Math.min(100, 16 + micVolume * 70)) : 12,
          }}
          transition={callState === 'speaking' ? { repeat: Infinity, duration: 0.8, ease: 'easeInOut', delay: 0.4 } : { duration: 0.1 }}
          className="w-3.5 rounded-full bg-gradient-to-t from-emerald-600 via-lime-400 to-emerald-300 shadow-lg"
        />
      </div>

      {spokenText.trim() !== '' && (
        <div className="text-center max-w-lg bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2">
            <p className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">Pooja (Murf Falcon Voice)</p>
            <p className="text-sm font-semibold text-slate-100 leading-relaxed italic">
              "{spokenText}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
