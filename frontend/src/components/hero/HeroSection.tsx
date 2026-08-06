'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Zap, Volume2, ShieldCheck, Heart, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative pt-12 pb-16 px-6 overflow-hidden">
      {/* Background Image Overlay with Gradient Fade */}
      <div className="absolute inset-0 z-0 opacity-40">
        <Image
          src="/hero_sunrise_bg.jpg"
          alt="Golden Terraced Paddy Fields"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020704]/60 via-[#020704]/80 to-[#020704]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 space-y-6"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold tracking-wide backdrop-blur-md shadow-lg shadow-emerald-500/10">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span>🇮🇳 VOICE FOR BHARAT EDITION • FARM & FIELD</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05]">
              Kisan <span className="text-gradient">Vani</span>
            </h1>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-200">
              AI Voice Companion for Farmers
            </h2>
          </div>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-medium">
            Your intelligent agricultural partner. Speak naturally in regional Indian languages to receive real-time mandi prices, hyper-local weather alerts, pest prevention advice, and government subsidy guides.
          </p>

          {/* Trust Metrics Pill Grid */}
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-panel text-xs font-semibold text-slate-200 border-emerald-500/30 hover:border-lime-400/50 transition-all">
              <Volume2 className="w-4 h-4 text-lime-400" />
              <span>15 Regional Indian Voices</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-panel text-xs font-semibold text-slate-200 border-emerald-500/30 hover:border-lime-400/50 transition-all">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Sub-100ms Falcon 2 Latency</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-panel text-xs font-semibold text-slate-200 border-emerald-500/30 hover:border-lime-400/50 transition-all">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Enterprise Agri-LLM Engine</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-panel text-xs font-semibold text-slate-200 border-emerald-500/30 hover:border-lime-400/50 transition-all">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Built for 140M+ Indian Farmers</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Interactive 3D AI Card & Speech Bubble */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="lg:col-span-5 relative flex flex-col items-center lg:items-end justify-center"
        >
          {/* Floating AI Speech Bubble */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="z-20 -mb-6 mr-4 max-w-xs p-4 rounded-2xl rounded-br-none bg-slate-900/95 border-2 border-emerald-500 text-slate-900 shadow-2xl shadow-emerald-500/30 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-extrabold text-emerald-400">Namaste Farmer! 🌾</h4>
            </div>
            <p className="text-xs font-medium text-slate-200 leading-snug">
              I am here to guide you with real-time crop care, mandi prices, and weather forecasts today.
            </p>
          </motion.div>

          {/* AI Visual Card */}
          <div className="relative w-full max-w-md rounded-3xl overflow-hidden border-2 border-lime-400/40 shadow-2xl shadow-black/80 group">
            <Image
              src="/kisan_vani_banner.png"
              alt="Kisan Vani AI Companion"
              width={500}
              height={500}
              className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
