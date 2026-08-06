'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { HeroSection } from '@/components/hero/HeroSection';
import { BentoGrid } from '@/components/bento/BentoGrid';
import { VoiceConsole } from '@/components/voice/VoiceConsole';
import { LiveKitVoiceCall } from '@/components/voice/LiveKitVoiceCall';
import { Footer } from '@/components/layout/Footer';
import { ParticleBackground } from '@/components/ui/ParticleBackground';

export default function Home() {
  const [selectedVoice, setSelectedVoice] = useState('Isha (Indian English - Female)');
  const [selectedQuery, setSelectedQuery] = useState('');
  const [isLiveCallOpen, setIsLiveCallOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#020704] text-slate-100 relative selection:bg-lime-400 selection:text-slate-950">
      {/* Full-Screen WebRTC LiveKit Agents Voice Call Overlay (Matches Screenshot) */}
      {isLiveCallOpen && (
        <LiveKitVoiceCall
          selectedVoice={selectedVoice}
          onClose={() => setIsLiveCallOpen(false)}
        />
      )}

      {/* Organic Animated Particle Field */}
      <ParticleBackground />

      {/* Sticky Glass Navbar */}
      <Navbar
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
        onStartLiveCall={() => setIsLiveCallOpen(true)}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* Bento Feature Grid with Click-to-Expand Drawers */}
      <BentoGrid onSelectQuery={(query) => setSelectedQuery(query)} />

      {/* Interactive AI Voice Console & WebAudio Waveform */}
      <VoiceConsole
        initialQuery={selectedQuery}
        selectedVoice={selectedVoice}
        onOpenLiveCall={() => setIsLiveCallOpen(true)}
      />

      {/* Footer */}
      <Footer />
    </main>
  );
}
