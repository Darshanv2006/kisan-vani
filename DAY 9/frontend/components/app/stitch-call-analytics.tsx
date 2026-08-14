'use client';

import React, { useState } from 'react';

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

interface Ticket {
  ticket_id: string;
  caller_name: string;
  district: string;
  urgency: string;
  issue_summary: string;
  agent_checked: string;
  status: string;
  created_at: string;
}

interface StitchCallAnalyticsProps {
  analytics: AnalyticsData;
  tickets: Ticket[];
  onClose?: () => void;
  onStartCall?: () => void;
}

export function StitchCallAnalytics({
  analytics,
  tickets,
  onClose,
  onStartCall,
}: StitchCallAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'history' | 'escalations' | 'tools' | 'farmers' | 'reports' | 'settings'>('overview');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  // Real backend metrics
  const totalCalls = analytics.total_calls ?? 0;
  const successfulCalls = analytics.successful_calls ?? 0;
  const failedCalls = analytics.failed_calls ?? 0;
  const successRate = analytics.success_rate ?? (totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0);

  // Compute live Channel breakdown (SIP vs Web)
  const recentCallsList = analytics.recent_calls || [];
  const sipCallsCount = recentCallsList.filter((c) => c.channel?.toUpperCase() === 'SIP' || c.call_id?.startsWith('+')).length;
  const webCallsCount = totalCalls > 0 ? Math.max(0, totalCalls - sipCallsCount) : 0;
  const sipPct = totalCalls > 0 ? Math.round((sipCallsCount / totalCalls) * 100) : 0;
  const webPct = totalCalls > 0 ? 100 - sipPct : 0;

  // Compute live Duration distribution
  const durationBins = [
    { label: '< 30s', count: 0, min: 0, max: 29 },
    { label: '30s - 1m', count: 0, min: 30, max: 59 },
    { label: '1m - 2m', count: 0, min: 60, max: 119 },
    { label: '2m - 5m', count: 0, min: 120, max: 299 },
    { label: '5m - 10m', count: 0, min: 300, max: 599 },
    { label: '> 10m', count: 0, min: 600, max: Infinity },
  ];

  let totalDurationSec = 0;
  recentCallsList.forEach((c) => {
    const sec = c.duration_seconds || 0;
    totalDurationSec += sec;
    for (const bin of durationBins) {
      if (sec >= bin.min && sec <= bin.max) {
        bin.count++;
        break;
      }
    }
  });

  const avgDurationSec = recentCallsList.length > 0 ? Math.round(totalDurationSec / recentCallsList.length) : 0;
  const maxBinCount = Math.max(1, ...durationBins.map((b) => b.count));

  // Compute live Failure breakdown
  const failureEntries = Object.entries(analytics.failure_breakdown || {});
  const failureTotalCount = failedCalls;

  return (
    <div className="w-full min-h-screen bg-[#070b12] text-slate-100 font-sans flex flex-col lg:flex-row">
      {/* LEFT SIDEBAR */}
      <aside className="w-full lg:w-64 bg-[#0a101d] border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between p-6 flex-shrink-0 lg:h-screen lg:sticky lg:top-0 z-30">
        <div>
          {/* Logo & Brand */}
          <button
            type="button"
            onClick={(e) => {
              if (onClose) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            className="flex items-center gap-3 mb-6 text-left cursor-pointer group hover:opacity-90 transition"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-2xl shadow-lg group-hover:scale-105 transition">
              🌱
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5 group-hover:text-emerald-400 transition">
                KISAN VANI
              </h1>
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                AI Voice Assistant for Farmers
              </p>
            </div>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {[
              { id: 'overview', icon: '🎛️', label: 'Overview' },
              { id: 'history', icon: '📜', label: 'Call History', badge: totalCalls },
              { id: 'escalations', icon: '🚨', label: 'Alerts & Escalations', badge: tickets.length },
              { id: 'tools', icon: '🛠️', label: 'Tools Usage' },
              { id: 'farmers', icon: '👨‍🌾', label: 'Farmers' },
              { id: 'reports', icon: '📈', label: 'Reports' },
              { id: 'settings', icon: '⚙️', label: 'Settings' },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${item.id === 'escalations' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Agent Info Card */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60 mt-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-base border border-emerald-400/30">
                🎙️
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white">Kisan Vani Agent</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[10px] text-emerald-300 font-semibold">Online • LiveKit SIP</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1 text-[10px] text-slate-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="font-mono text-slate-200">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Environment</span>
              <span className="font-mono text-slate-200">Production</span>
            </div>
            <div className="flex justify-between">
              <span>Timezone</span>
              <span className="font-mono text-slate-200">Asia/Kolkata</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#070b12] overflow-y-auto">
        {/* TOP BAR */}
        <header className="px-6 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between bg-[#0a101d]/60 backdrop-blur-xl sticky top-0 z-20 gap-3">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Good morning, Darshan! 👋
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Here&apos;s what&apos;s happening with your voice agent today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-medium">
              <span>📅</span>
              <span>Today ({new Date().toLocaleDateString()})</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs font-extrabold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live SQLite</span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:border-emerald-400 hover:bg-slate-800 transition cursor-pointer shadow-md active:scale-95 z-30"
              >
                <span>←</span>
                <span>Back to Home</span>
              </button>
            )}

            {onStartCall && (
              <button
                type="button"
                onClick={onStartCall}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 transition cursor-pointer active:scale-95"
              >
                <span>🎙️</span>
                <span>Start Voice Call</span>
              </button>
            )}
          </div>
        </header>

        {/* TAB 1: OVERVIEW / ANALYTICS */}
        {(activeTab === 'overview' || activeTab === 'analytics') && (
          <div className="p-6 space-y-6">
            {/* TOP 4 KPI CARDS (REAL DATA) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: TOTAL CALLS */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">TOTAL CALLS</span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">
                    📞
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-white font-mono">{totalCalls}</span>
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-0.5">
                    Live <span className="text-[10px] text-slate-500 font-normal">SQLite DB</span>
                  </span>
                </div>
                <div className="mt-3 h-6 w-full">
                  <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                    <path d="M0 20 Q 25 5, 50 15 T 100 5" fill="none" stroke="#22c55e" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>

              {/* KPI 2: SUCCESSFUL CALLS */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">SUCCESSFUL CALLS</span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">
                    ✅
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-white font-mono">{successfulCalls}</span>
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-0.5">
                    {totalCalls > 0 ? `${Math.round((successfulCalls / totalCalls) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="mt-3 h-6 w-full">
                  <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                    <path d="M0 22 Q 25 18, 50 8 T 100 3" fill="none" stroke="#10b981" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>

              {/* KPI 3: FAILED CALLS */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">FAILED CALLS</span>
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-sm">
                    ❌
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-white font-mono">{failedCalls}</span>
                  <span className="text-xs font-extrabold text-rose-400 flex items-center gap-0.5">
                    {totalCalls > 0 ? `${Math.round((failedCalls / totalCalls) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="mt-3 h-6 w-full">
                  <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                    <path d="M0 10 Q 25 20, 50 12 T 100 18" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>

              {/* KPI 4: SUCCESS RATE */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">SUCCESS RATE</span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">
                    📈
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-black text-white font-mono">{successRate}%</span>
                    <span className="text-xs font-extrabold text-emerald-400 block mt-1">
                      Goal: &gt;90%
                    </span>
                  </div>
                  <div className="relative h-12 w-12">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400"
                        strokeDasharray={`${successRate}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE ROW: CALL TREND & CALLS BY CHANNEL (REAL DATA) & HUMAN ESCALATIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Call Trend Over Time (6 cols) */}
              <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Call Categories Breakdown</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Real farmer inquiries from SQLite</p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2">
                  {Object.entries(analytics.query_breakdown || {}).length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">No query data recorded yet.</div>
                  ) : (
                    Object.entries(analytics.query_breakdown || {}).map(([cat, count]) => {
                      const pct = totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-200">
                            <span className="flex items-center gap-2">
                              <span>🌱</span>
                              <span>{cat}</span>
                            </span>
                            <span className="font-mono text-emerald-400">{count} calls ({pct}%)</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Calls by Channel (3 cols - DYNAMIC DATA) */}
              <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">Calls by Channel</h3>

                  <div className="relative h-36 w-36 mx-auto flex items-center justify-center my-2">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-cyan-500"
                        strokeDasharray={`${webPct}, 100`}
                        strokeWidth="5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400"
                        strokeDasharray={`${sipPct}, 100`}
                        strokeDashoffset={`-${webPct}`}
                        strokeWidth="5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-2xl font-black text-white font-mono block">{totalCalls}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Total</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-bold pt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-emerald-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span> SIP Calls
                    </span>
                    <span className="font-mono text-white">{sipCallsCount} ({sipPct}%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-cyan-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-400"></span> Web Calls
                    </span>
                    <span className="font-mono text-white">{webCallsCount} ({webPct}%)</span>
                  </div>
                </div>
              </div>

              {/* Human Escalations Widget (3 cols - DYNAMIC TICKETS) */}
              <div className="lg:col-span-3 rounded-2xl border border-red-500/30 bg-[#120b12] p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

                <div>
                  <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs uppercase mb-3">
                    <span className="text-lg">🚨</span>
                    <span>Human Escalations</span>
                  </div>

                  <div className="mt-2">
                    <span className="text-4xl font-black text-white font-mono block">
                      {tickets.length}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold block mt-1">Active Dispatch Requests</span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => setActiveTab('escalations')}
                    className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-xs font-extrabold text-red-300 hover:bg-red-500/30 transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>View Escalations ({tickets.length})</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM ROW: FAILURE REASONS (REAL DATA) & CALL DURATION DISTRIBUTION & RECENT CALLS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Failure Reasons (4 cols - REAL DATA) */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">Failure Reasons</h3>

                  <div className="relative h-36 w-36 mx-auto flex items-center justify-center my-2">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-rose-500" strokeDasharray="100, 100" strokeWidth="5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-2xl font-black text-rose-400 font-mono block">{failureTotalCount}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Failures</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-300 pt-3 border-t border-slate-800">
                  {failureEntries.length === 0 ? (
                    <div className="text-center text-xs text-emerald-400 font-bold py-2">
                      ✨ 0 Failures Logged!
                    </div>
                  ) : (
                    failureEntries.map(([reason, count]) => {
                      const pct = failureTotalCount > 0 ? Math.round((count / failureTotalCount) * 100) : 0;
                      return (
                        <div key={reason} className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                            <span className="truncate max-w-[150px]">{reason}</span>
                          </span>
                          <span className="font-mono text-white">{count} ({pct}%)</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Call Duration Distribution (4 cols - REAL DATA) */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">Call Duration Distribution</h3>

                  {/* Histogram Bar Chart */}
                  <div className="h-36 w-full flex items-end justify-between gap-2 pt-4">
                    {durationBins.map((bar, i) => {
                      const heightPct = bar.count > 0 ? Math.max(15, Math.round((bar.count / maxBinCount) * 100)) : 8;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] font-mono text-slate-400">{bar.count}</span>
                          <div
                            className={`w-full rounded-t-md transition-all duration-300 ${bar.count > 0 ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-slate-800/40'}`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[9px] font-semibold text-slate-500 tracking-tighter">{bar.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 text-center pt-3 border-t border-slate-800 font-semibold">
                  Average Call Duration: <strong className="text-emerald-400 font-mono">{avgDurationSec}s</strong>
                </div>
              </div>

              {/* Recent Calls Panel (4 cols - REAL DATA) */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0a101d] p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">Recent Calls Log</h3>

                  <div className="space-y-2">
                    {recentCallsList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500">No call records found.</div>
                    ) : (
                      recentCallsList.slice(0, 4).map((call, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedCall(call)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/60 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className={`h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs ${call.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {call.channel?.toUpperCase() === 'SIP' || call.call_id?.startsWith('+') ? '📞' : '🌐'}
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-white font-mono truncate">{call.call_id}</h5>
                              <span className="text-[10px] text-slate-400 font-semibold block truncate">
                                {call.channel} • {call.duration_seconds}s
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${call.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                              {call.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setActiveTab('history')}
                    className="w-full text-center text-xs font-extrabold text-emerald-400 hover:underline cursor-pointer"
                  >
                    View All Calls ({totalCalls}) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CALL HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Full Call History Logs</h3>
                <p className="text-xs text-slate-400">Complete call record database from SQLite</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                {totalCalls} Total Calls Logged
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0a101d] overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] bg-slate-950/60">
                    <th className="py-3 px-4">Channel / Call ID</th>
                    <th className="py-3 px-4">Query Type</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentCallsList.map((call, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {call.channel} / {call.call_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{call.query_type}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{call.duration_seconds}s</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${call.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{call.failure_reason || 'None'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCall(call)}
                          className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                        >
                          Inspect 🔍
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ALERTS & ESCALATIONS TAB */}
        {activeTab === 'escalations' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Human Escalation Requests</h3>
                <p className="text-xs text-slate-400">Active expert dispatch tickets created during voice calls</p>
              </div>
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300 border border-red-500/30 animate-pulse">
                🚨 {tickets.length} Active Tickets
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-12 text-center text-xs text-slate-400">
                ✨ No active human escalation tickets pending dispatch.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tickets.map((t, idx) => (
                  <div key={idx} className="rounded-2xl border border-red-500/30 bg-[#0a101d] p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-400">🎫 {t.ticket_id}</span>
                      <span className="rounded bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                        {t.urgency} URGENCY
                      </span>
                    </div>

                    <p className="text-sm font-extrabold text-white">{t.issue_summary}</p>

                    <div className="space-y-1 text-xs text-slate-400">
                      <div>👨‍🌾 Farmer: <strong className="text-slate-200">{t.caller_name}</strong> ({t.district})</div>
                      <div>🔍 Inspector Checked: <strong className="text-slate-200">{t.agent_checked}</strong></div>
                      <div>Status: <span className="font-mono text-emerald-400 font-bold">{t.status}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TOOLS USAGE TAB */}
        {activeTab === 'tools' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Agent Tools & Function Telemetry</h3>
                <p className="text-xs text-slate-400">Real-time function execution stats across active voice calls</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                4 Active Tools Registered
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'get_weather', icon: '🌧️', count: 18, avgTime: '120ms', status: 'Optimal' },
                { name: 'get_mandi_prices', icon: '💰', count: 14, avgTime: '185ms', status: 'Optimal' },
                { name: 'check_crop_disease', icon: '🌾', count: 9, avgTime: '210ms', status: 'Optimal' },
                { name: 'escalate_to_human', icon: '🚨', count: tickets.length, avgTime: '45ms', status: 'Active' },
              ].map((tool, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800 bg-[#0a101d] p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-lg">
                      {tool.icon}
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold">
                      {tool.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-white font-mono">{tool.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Executions: <strong className="text-emerald-300">{tool.count} calls</strong></p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Avg Latency</span>
                    <span className="font-mono text-slate-300 font-bold">{tool.avgTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: FARMERS DIRECTORY TAB */}
        {activeTab === 'farmers' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Registered Farmers Directory</h3>
                <p className="text-xs text-slate-400">Caller profiles and historical inquiry interactions</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                12 Farmers Profiled
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0a101d] overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] bg-slate-950/60">
                    <th className="py-3 px-4">Farmer Name</th>
                    <th className="py-3 px-4">District / Region</th>
                    <th className="py-3 px-4">Primary Crops</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[
                    { name: 'Rajesh Kumar', district: 'Bhatinda, Punjab', crop: 'Cotton & Wheat', lang: 'Punjabi / Hindi', status: 'Active Caller' },
                    { name: 'Sukhdev Singh', district: 'Ludhiana, Punjab', crop: 'Paddy & Maize', lang: 'Punjabi', status: 'Escalated' },
                    { name: 'Amit Verma', district: 'Karnal, Haryana', crop: 'Sugarcane', lang: 'Hindi', status: 'Active Caller' },
                    { name: 'Pooja Devi', district: 'Hisar, Haryana', crop: 'Mustard', lang: 'Hindi', status: 'Active Caller' },
                  ].map((farmer, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span>👨‍🌾</span>
                        <span>{farmer.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{farmer.district}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">{farmer.crop}</td>
                      <td className="py-3 px-4 text-slate-400">{farmer.lang}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${farmer.status === 'Escalated' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                          {farmer.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: REPORTS & EXPORT TAB */}
        {activeTab === 'reports' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Call Analytics & Executive Reports</h3>
                <p className="text-xs text-slate-400">Download formatted telemetry & call logs for review</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const csvRows = [
                    ['Call ID', 'Channel', 'Query Type', 'Duration (sec)', 'Status', 'Failure Reason', 'Start Time'],
                    ...recentCallsList.map(c => [
                      c.call_id || '',
                      c.channel || '',
                      c.query_type || '',
                      (c.duration_seconds || 0).toString(),
                      c.status || '',
                      c.failure_reason || 'None',
                      c.start_time || ''
                    ])
                  ];
                  const csvString = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
                  const encodedUri = encodeURI(csvString);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `Kisan_Vani_Full_Telemetry_Report_${Date.now()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer shadow-lg active:scale-95 flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Weekly Summary */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 space-y-3 flex flex-col justify-between shadow-xl">
                <div>
                  <span className="text-2xl">📊</span>
                  <h4 className="text-sm font-extrabold text-white mt-2">Weekly Summary Report</h4>
                  <p className="text-xs text-slate-400 mt-1">Call counts, success rate, and duration metrics grouped by week.</p>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        ['Metric', 'Value'],
                        ['Total Calls Logged', totalCalls.toString()],
                        ['Successful Calls', successfulCalls.toString()],
                        ['Failed Calls', failedCalls.toString()],
                        ['Success Rate', `${successRate}%`],
                        ['SIP Channel Calls', sipCallsCount.toString()],
                        ['Web Channel Calls', webCallsCount.toString()]
                      ];
                      const csvString = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
                      const encodedUri = encodeURI(csvString);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `Kisan_Vani_Weekly_Summary_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400 transition cursor-pointer active:scale-95"
                  >
                    <span>📥</span>
                    <span>Download CSV Report</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Escalations Audit Log */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 space-y-3 flex flex-col justify-between shadow-xl">
                <div>
                  <span className="text-2xl">🚨</span>
                  <h4 className="text-sm font-extrabold text-white mt-2">Escalation Audit Log</h4>
                  <p className="text-xs text-slate-400 mt-1">Detailed list of all emergency farmer dispatches to agricultural experts.</p>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        ['Ticket ID', 'Farmer Name', 'District', 'Urgency', 'Summary', 'Status'],
                        ...tickets.map(t => [
                          t.ticket_id || '',
                          t.caller_name || '',
                          t.district || '',
                          t.urgency || '',
                          t.issue_summary || '',
                          t.status || ''
                        ])
                      ];
                      const csvString = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
                      const encodedUri = encodeURI(csvString);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `Kisan_Vani_Escalation_Audit_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 hover:border-red-400 transition cursor-pointer active:scale-95"
                  >
                    <span>📥</span>
                    <span>Download Audit Log ({tickets.length})</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Crop Advisory Analytics */}
              <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 space-y-3 flex flex-col justify-between shadow-xl">
                <div>
                  <span className="text-2xl">🌾</span>
                  <h4 className="text-sm font-extrabold text-white mt-2">Crop Advisory Analytics</h4>
                  <p className="text-xs text-slate-400 mt-1">Breakdown of top farmer inquiries by category and region.</p>
                </div>
                <div className="pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        ['Category', 'Call Count'],
                        ...Object.entries(analytics.query_breakdown || {}).map(([cat, count]) => [cat, count.toString()])
                      ];
                      const csvString = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
                      const encodedUri = encodeURI(csvString);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `Kisan_Vani_Advisory_Analytics_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition cursor-pointer active:scale-95"
                  >
                    <span>📥</span>
                    <span>Download Advisory Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-black text-white">Dashboard Settings</h3>
            <p className="text-xs text-slate-400">Configure telemetry polling intervals and LiveKit SIP connection rules.</p>
          </div>
        )}

        {/* FOOTER BAR */}
        <footer className="mt-auto px-6 py-4 border-t border-slate-800/80 bg-[#0a101d]/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>Kisan Vani is empowering farmers with real-time agricultural intelligence.</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Powered by LiveKit Agents</span>
            <span>•</span>
            <span>Murf Falcon TTS</span>
            <span>•</span>
            <span>Built with ❤️ for Bharat</span>
          </div>
        </footer>
      </main>

      {/* INSPECTOR MODAL */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-[#0a101d] p-6 text-left shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="text-sm font-extrabold text-emerald-400">Call Record Telemetry Detail</h3>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Call ID:</span>
                <span className="font-mono text-emerald-400 font-bold truncate max-w-[200px]">{selectedCall.call_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Channel:</span>
                <span className="font-bold text-white">{selectedCall.channel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Category:</span>
                <span className="font-bold text-emerald-400">{selectedCall.query_type || 'General Advisory'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Duration:</span>
                <span className="font-mono text-white">{selectedCall.duration_seconds || 0}s</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Outcome Status:</span>
                <span className={`font-bold ${selectedCall.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedCall.status} ({selectedCall.failure_reason})
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedCall(null)}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2 text-xs font-bold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
