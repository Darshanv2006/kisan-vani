import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface EscalationTicket {
  ticket_id: string;
  caller_name: string;
  district: string;
  issue_category: string;
  urgency: string;
  issue_summary: string;
  agent_checked: string;
  user_consent_granted: boolean;
  status: string;
  created_at: string;
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Top Seamless Full-Width Emerald Glow */}
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-transparent blur-2xl dark:from-emerald-500/30" />
      {/* Central Radial Glow */}
      <div className="absolute -top-10 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/25 blur-[120px] dark:bg-emerald-500/30" />
      {/* Center Teal Accent */}
      <div className="absolute top-1/3 left-1/2 h-[400px] w-[550px] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
    </div>
  );
}

function FarmHeroIcon() {
  return (
    <div className="relative mb-6">
      {/* Ambient Pulsing Glow Ring */}
      <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 opacity-40 blur-xl animate-pulse"></div>
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-gradient-to-b from-emerald-950/80 to-background shadow-2xl backdrop-blur-2xl">
        <span className="text-6xl filter drop-shadow-[0_4px_12px_rgba(16,185,129,0.5)]">🌾</span>
      </div>
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [tickets, setTickets] = useState<EscalationTicket[]>([]);

  const fetchEscalations = async () => {
    try {
      const res = await fetch('/api/escalations');
      const data = await res.json();
      if (data.success && data.tickets) {
        setTickets(data.tickets);
      }
    } catch (e) {
      console.error('Failed fetching tickets:', e);
    }
  };

  useEffect(() => {
    fetchEscalations();
    const interval = setInterval(fetchEscalations, 3000);
    return () => clearInterval(interval);
  }, []);

  const sampleTopics = [
    { icon: '🌾', title: 'Crop Advisory', subtitle: 'Soil, seeds & fertilizer tips' },
    { icon: '🌧️', title: 'Weather Alerts', subtitle: 'Rain & irrigation timing' },
    { icon: '💰', title: 'PM-KISAN Scheme', subtitle: 'Subsidy & registration help' },
    { icon: '🚨', title: 'Human Escalation', subtitle: 'Severe pest & crop emergencies' },
  ];

  return (
    <div ref={ref} className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 pt-16 pb-8">
      <AmbientBackground />

      <section className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <FarmHeroIcon />

        {/* Track Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-extrabold text-emerald-600 shadow-md backdrop-blur-md dark:text-emerald-400">
          <span>🌾 Farm & Field AI Assistant • Day 7 Human-in-the-Loop</span>
        </div>

        {/* Title & Hindi Subtitle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-500 bg-clip-text text-transparent">
              Kisan Vani
            </span>
          </h1>
          <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-lg font-bold text-emerald-600 dark:text-emerald-300 shadow-sm backdrop-blur-md">
            किसान वाणी
          </span>
        </div>

        <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
          Your 24/7 AI Agricultural Voice Assistant. Smart crop advisory with <strong>Human Escalation Dispatch</strong> for emergencies.
        </p>

        {/* State 1: Ready Indicator Pill */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2 text-xs font-bold text-emerald-600 shadow-lg backdrop-blur-xl dark:text-emerald-300">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <span>Status: <strong className="text-emerald-500 dark:text-emerald-300">Ready</strong> — Click below to start voice call</span>
        </div>

        {/* 4 Interactive Topic Cards */}
        <div className="mt-8 grid w-full grid-cols-2 gap-3.5 sm:grid-cols-4">
          {sampleTopics.map((topic, i) => (
            <div
              key={i}
              className="group flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-background/50 p-4 text-center backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/10"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 shadow-inner transition duration-300 group-hover:scale-110">
                <span className="text-2xl">{topic.icon}</span>
              </div>
              <span className="text-xs font-bold text-foreground group-hover:text-emerald-400">{topic.title}</span>
              <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{topic.subtitle}</span>
            </div>
          ))}
        </div>

        {/* Call Action Button */}
        <div className="relative mt-9 group">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 opacity-80 blur-md transition duration-300 group-hover:opacity-100 group-hover:blur-lg"></div>
          <Button
            size="lg"
            onClick={onStartCall}
            className="relative h-14 w-72 sm:w-80 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-extrabold text-white shadow-2xl transition-all duration-300 hover:from-emerald-500 hover:to-teal-500 active:scale-95 cursor-pointer"
          >
            <span className="mr-2.5 text-2xl animate-pulse">🎙️</span>
            {startButtonText}
          </Button>
        </div>

        {/* Active Human Escalation Tickets Card */}
        {tickets.length > 0 && (
          <div className="mt-10 w-full rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-950/20 to-background/80 p-5 text-left backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <h3 className="text-sm font-bold text-red-400">Human Escalation Requests ({tickets.length})</h3>
              </div>
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-red-300 border border-red-500/30 animate-pulse">
                LIVE DISPATCH ACTIVE
              </span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {tickets.map((t, idx) => (
                <div key={idx} className="rounded-xl border border-emerald-500/20 bg-background/60 p-3.5 shadow-sm transition hover:border-emerald-500/40">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="text-emerald-400">🎫 Ticket: {t.ticket_id}</span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-bold">
                      {t.urgency} URGENCY
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{t.issue_summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span>👨‍🌾 {t.caller_name} ({t.district})</span>
                    <span>🔍 {t.agent_checked}</span>
                    <span>✅ Consent: Granted</span>
                    <span className="ml-auto font-mono text-emerald-400">Status: {t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-muted-foreground opacity-80">
        Kisan Vani AI Voice Assistant • Powered by Murf Falcon TTS & LiveKit Agents
      </footer>
    </div>
  );
};

