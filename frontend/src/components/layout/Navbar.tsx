'use client';

import { motion } from 'framer-motion';
import { Mic, Activity, Globe, Sparkles } from 'lucide-react';

interface NavbarProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onStartLiveCall?: () => void;
}

export const INDIAN_VOICES = [
  { id: "en-IN-isha", name: "Isha (Indian English - Female)", lang: "English (India)" },
  { id: "en-IN-rohan", name: "Rohan (Indian English - Male)", lang: "English (India)" },
  { id: "en-IN-arohi", name: "Arohi (Indian English - Female)", lang: "English (India)" },
  { id: "en-IN-eashwar", name: "Eashwar (Indian English - Male)", lang: "English (India)" },
  { id: "hi-IN-kabir", name: "Kabir (Hindi - Male)", lang: "Hindi" },
  { id: "hi-IN-shweta", name: "Shweta (Hindi - Female)", lang: "Hindi" },
  { id: "hi-IN-rahul", name: "Rahul (Hindi - Male)", lang: "Hindi" },
  { id: "hi-IN-ayushi", name: "Ayushi (Hindi - Female)", lang: "Hindi" },
  { id: "ta-IN-sarvesh", name: "Sarvesh (Tamil - Male)", lang: "Tamil" },
  { id: "ta-IN-iniya", name: "Iniya (Tamil - Female)", lang: "Tamil" },
  { id: "bn-IN-arnab", name: "Arnab (Bengali - Male)", lang: "Bengali" },
  { id: "bn-IN-anwesha", name: "Anwesha (Bengali - Female)", lang: "Bengali" },
];

export function Navbar({ selectedVoice, onVoiceChange, onStartLiveCall }: NavbarProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 px-6 py-4 glass-panel border-b border-emerald-500/20 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#040D07] rounded-[10px] flex items-center justify-center">
              <Mic className="w-5 h-5 text-lime-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white">
                Kisan <span className="text-gradient">Vani</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Voice for Bharat
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">AI Agricultural Companion</p>
          </div>
        </div>

        {/* Regional Voice Selector & Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/25 text-xs text-slate-300">
            <Globe className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedVoice}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer pr-2"
            >
              {INDIAN_VOICES.map((voice) => (
                <option key={voice.id} value={voice.name} className="bg-[#0A1A10] text-white">
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Murf Falcon 2 • Active</span>
          </div>

          {onStartLiveCall && (
            <button
              onClick={onStartLiveCall}
              className="px-3.5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>📞 Live Voice Call</span>
            </button>
          )}

          <button
            onClick={() => {
              const consoleElem = document.getElementById('voice-console-section');
              consoleElem?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Talk to AI</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
