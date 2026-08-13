'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { StitchCallAnalytics } from '@/components/app/stitch-call-analytics';

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

interface CallRecord {
  call_id: string;
  user_id: string;
  channel: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  status: string;
  failure_reason: string;
  query_type: string;
  language: string;
  tools_used: string;
  created_at: string;
}

interface AnalyticsData {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  success_rate: number;
  failure_breakdown: Record<string, number>;
  query_breakdown: Record<string, number>;
  recent_calls: CallRecord[];
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Top Seamless Full-Width Emerald Glow */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-emerald-500/20 via-teal-500/10 to-transparent blur-3xl" />
      {/* Central Radial Glow */}
      <div className="absolute -top-10 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[130px]" />
      {/* Center Teal Accent */}
      <div className="absolute top-1/3 left-1/2 h-[450px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />
    </div>
  );
}

function FarmHeroIcon() {
  return (
    <div className="relative mb-6">
      {/* Ambient Pulsing Glow Ring */}
      <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 opacity-40 blur-xl animate-pulse"></div>
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/90 to-slate-950 shadow-2xl backdrop-blur-2xl">
        <span className="text-5xl filter drop-shadow-[0_4px_12px_rgba(16,185,129,0.5)]">🌾</span>
      </div>
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export function WelcomeView({
  startButtonText,
  onStartCall,
  ...props
}: React.ComponentProps<'div'> & WelcomeViewProps) {
  const [tickets, setTickets] = useState<EscalationTicket[]>([]);

  // Section switcher state: 'home' | 'analytics'
  const [activeSection, setActiveSection] = useState<'home' | 'analytics'>('home');

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    success_rate: 0.0,
    failure_breakdown: {},
    query_breakdown: {},
    recent_calls: [],
  });

  const fetchEscalations = async () => {
    try {
      const res = await fetch('/api/escalations').catch(() => null);
      if (!res || !res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json().catch(() => null);
      if (data && data.success && data.tickets) {
        setTickets(data.tickets);
      }
    } catch {
      // Silently ignore background polling network errors
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
      if (!res || !res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setAnalyticsData(json);
      }
    } catch {
      // Silently ignore background polling network errors
    }
  };

  useEffect(() => {
    fetchEscalations();
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchEscalations();
      fetchAnalytics();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sampleTopics = [
    { icon: '🌾', title: 'Crop Advisory', subtitle: 'Soil, seeds & fertilizer tips' },
    { icon: '🌧️', title: 'Weather Alerts', subtitle: 'Rain & irrigation timing' },
    { icon: '💰', title: 'PM-KISAN Scheme', subtitle: 'Subsidy & registration help' },
    { icon: '🚨', title: 'Human Escalation', subtitle: 'Severe pest & crop emergencies' },
  ];

  const handleBackToHome = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveSection('home');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Main WebRTC Call connecting state
  const [isConnecting, setIsConnecting] = useState(false);

  const handleStartCallWithFeedback = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    const safetyTimer = setTimeout(() => {
      setIsConnecting(false);
    }, 5000);

    try {
      if (onStartCall) {
        await onStartCall();
      }
    } catch (err) {
      console.warn('Call start notice:', err);
    } finally {
      clearTimeout(safetyTimer);
      setIsConnecting(false);
    }
  };

  // Linphone SIP Outbound state
  const [showLinphoneModal, setShowLinphoneModal] = useState(false);
  const [linphoneUser, setLinphoneUser] = useState('shivu');
  const [sipCalling, setSipCalling] = useState(false);
  const [sipStatus, setSipStatus] = useState<string | null>(null);

  const handleDialLinphone = async () => {
    if (!linphoneUser.trim()) return;
    setSipCalling(true);
    setSipStatus('📡 Connecting to LiveKit SIP Outbound Trunk...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/sip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: linphoneUser.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok && data.success) {
        setSipStatus(`✅ ${data.message} Your Linphone softphone should be ringing now!`);
      } else {
        setSipStatus(`❌ Call Failed: ${data.error || 'Failed to initiate SIP call'}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setSipStatus('⚠️ Timeout: LiveKit SIP API request took longer than expected. Please verify your internet connection or use the Terminal CLI command below.');
      } else {
        setSipStatus(`❌ Network error: ${err.message}`);
      }
    } finally {
      setSipCalling(false);
    }
  };

  // RENDER DEDICATED FULL-SCREEN CALL ANALYTICS WEBSITE DASHBOARD
  if (activeSection === 'analytics') {
    return (
      <div {...props} className="fixed inset-0 z-50 overflow-y-auto bg-[#070b12] text-slate-100">
        <StitchCallAnalytics
          analytics={analyticsData}
          tickets={tickets}
          onClose={handleBackToHome}
          onStartCall={onStartCall}
        />
      </div>
    );
  }

  // RENDER MAIN HOME SECTION
  return (
    <div {...props} className="relative flex min-h-screen w-full flex-col items-center justify-start px-4 pt-28 pb-16">
      <AmbientBackground />

      {/* LINPHONE SIP OUTBOUND MODAL */}
      {showLinphoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-[#0a101d] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl">
                  ☎️
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Call via Linphone (SIP)</h3>
                  <p className="text-xs text-slate-400">Outbound SIP Telephony Call</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLinphoneModal(false);
                  setSipStatus(null);
                }}
                className="h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                Linphone Username / Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm text-slate-500 font-mono">sip:</span>
                <input
                  type="text"
                  value={linphoneUser}
                  onChange={(e) => setLinphoneUser(e.target.value)}
                  placeholder="e.g. shivu or john@sip.linphone.org"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-12 pr-4 text-xs font-mono text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500">Presets:</span>
                {['shivu', 'farmer-test', 'advisory-hub'].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setLinphoneUser(name)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-mono text-emerald-400 hover:border-emerald-500/50 transition cursor-pointer"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Call Status */}
            {sipStatus && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono leading-relaxed">
                {sipStatus}
              </div>
            )}

            {/* CLI Command Helper Box */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Terminal CLI Method:</span>
              <code className="block text-[11px] font-mono text-emerald-400 bg-slate-900 p-2 rounded-lg border border-slate-800 overflow-x-auto">
                cd backend && uv run python src/dial.py --to {linphoneUser || 'shivu'}
              </code>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLinphoneModal(false);
                  setSipStatus(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sipCalling}
                onClick={handleDialLinphone}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 transition cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span>☎️</span>
                <span>{sipCalling ? 'Dialing SIP...' : 'Dial Linphone Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <FarmHeroIcon />

        {/* Track Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-extrabold text-emerald-400 shadow-md backdrop-blur-md">
          <span>🌾 Farm & Field AI Assistant • Day 8 Challenge</span>
        </div>

        {/* Title & Hindi Subtitle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 bg-clip-text text-transparent">
              Kisan Vani
            </span>
          </h1>
          <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-lg font-bold text-emerald-300 shadow-sm backdrop-blur-md">
            किसान वाणी
          </span>
        </div>

        <p className="mt-3 max-w-xl text-base text-slate-300 sm:text-lg leading-relaxed">
          Your 24/7 AI Agricultural Voice Assistant. Smart crop advisory with <strong>Human Escalation Dispatch</strong> for emergencies.
        </p>

        {/* Status Indicator Pill */}
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2 text-xs font-bold text-emerald-300 shadow-lg backdrop-blur-xl">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <span>Status: <strong className="text-emerald-300">Ready</strong> — Click below to start voice call</span>
        </div>

        {/* 4 Interactive Topic Cards */}
        <div className="mt-8 grid w-full grid-cols-2 gap-3.5 sm:grid-cols-4">
          {sampleTopics.map((topic, i) => (
            <div
              key={i}
              className="group flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-slate-900/90"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-inner transition duration-300 group-hover:scale-110">
                <span className="text-2xl">{topic.icon}</span>
              </div>
              <span className="text-xs font-bold text-white group-hover:text-emerald-400">{topic.title}</span>
              <span className="text-[10px] text-slate-400 mt-1 leading-tight">{topic.subtitle}</span>
            </div>
          ))}
        </div>

        {/* Call Action Buttons Row */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Main Start Call Button */}
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 opacity-80 blur-md transition duration-300 group-hover:opacity-100 group-hover:blur-lg"></div>
            <Button
              size="lg"
              onClick={handleStartCallWithFeedback}
              disabled={isConnecting}
              className="relative h-14 w-72 sm:w-80 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-extrabold text-white shadow-2xl transition-all duration-300 hover:from-emerald-500 hover:to-teal-500 active:scale-95 cursor-pointer disabled:opacity-80"
            >
              {isConnecting ? (
                <div className="flex items-center justify-center gap-2">
                  <CircleNotch className="h-6 w-6 animate-spin text-white" />
                  <span>Connecting to Kisan Vani...</span>
                </div>
              ) : (
                <>
                  <span className="mr-2.5 text-2xl animate-pulse">🎙️</span>
                  {startButtonText}
                </>
              )}
            </Button>
          </div>

          {/* Switch to Dedicated Call Analytics Section Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveSection('analytics');
            }}
            className="relative flex h-14 items-center justify-center gap-2.5 rounded-full border border-slate-700 bg-slate-900/90 px-6 text-sm font-extrabold text-slate-200 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <span className="text-lg">📊</span>
            <span>View Call Analytics Section</span>
          </button>

          {/* Dial Linphone (SIP Outbound) Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowLinphoneModal(true);
            }}
            className="relative flex h-14 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-6 text-sm font-extrabold text-slate-200 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <span className="text-lg">☎️</span>
            <span>Call via Linphone</span>
          </button>
        </div>

        {/* Active Human Escalation Tickets Card */}
        {tickets.length > 0 && (
          <div className="mt-10 w-full rounded-2xl border border-red-500/30 bg-slate-900/80 p-5 text-left backdrop-blur-xl shadow-2xl">
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
                <div key={idx} className="rounded-xl border border-emerald-500/20 bg-slate-950 p-3.5 shadow-sm transition hover:border-emerald-500/40">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="text-emerald-400">🎫 Ticket: {t.ticket_id}</span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-bold">
                      {t.urgency} URGENCY
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-300">{t.issue_summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
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
      <footer className="mt-16 text-center text-xs text-slate-500 opacity-80 z-10">
        Kisan Vani AI Voice Assistant • Powered by Murf Falcon TTS & LiveKit Agents
      </footer>
    </div>
  );
}
