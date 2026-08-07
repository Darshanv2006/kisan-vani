'use client';

import { LiveKitVoiceCall } from '@/components/voice/LiveKitVoiceCall';
import { ParticleBackground } from '@/components/ui/ParticleBackground';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020704] text-slate-100 relative overflow-hidden select-none">
      <ParticleBackground />
      <LiveKitVoiceCall />
    </main>
  );
}
