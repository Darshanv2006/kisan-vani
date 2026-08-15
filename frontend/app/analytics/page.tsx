'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    success_rate: 0.0,
    failure_breakdown: {},
    query_breakdown: {},
    recent_calls: [],
  });

  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'BROWSER' | 'SIP'>('ALL');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
      if (!res || !res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setData(json);
      }
    } catch {
      // Silently ignore background polling network errors
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredCalls = data.recent_calls.filter((c) => {
    if (filter === 'SUCCESS' && c.status !== 'SUCCESS') return false;
    if (filter === 'FAILED' && c.status !== 'FAILED') return false;
    if (filter === 'BROWSER' && c.channel !== 'Browser') return false;
    if (filter === 'SIP' && c.channel !== 'SIP') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.call_id.toLowerCase().includes(q) ||
        c.query_type.toLowerCase().includes(q) ||
        c.channel.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-emerald-500/20 bg-slate-950/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-xl font-bold shadow-lg shadow-emerald-950">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">Kisan Vani Analytics</h1>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 border border-emerald-500/30">
                  DAY 10 OFFICIAL
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Voice Agent Performance & Telemetry Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              SQLite Synced
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-emerald-500 hover:bg-slate-800 hover:text-white"
            >
              ← Back to Agent Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-6 py-8 relative z-10 space-y-8">
        
        {/* KPI Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Calls */}
          <div className="relative group overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900/90 via-blue-950/20 to-slate-900/90 p-6 shadow-xl backdrop-blur-xl transition hover:border-blue-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-blue-400">Total Calls Handled</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-lg text-blue-300">📞</span>
            </div>
            <div className="mt-4 text-4xl font-black tracking-tight text-white">{data.total_calls}</div>
            <p className="mt-2 text-xs text-slate-400">Combined Browser & SIP telephony</p>
          </div>

          {/* Card 2: Successful Calls */}
          <div className="relative group overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/90 via-emerald-950/20 to-slate-900/90 p-6 shadow-xl backdrop-blur-xl transition hover:border-emerald-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Successful Inquiries</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-lg text-emerald-300">✅</span>
            </div>
            <div className="mt-4 text-4xl font-black tracking-tight text-emerald-400">{data.successful_calls}</div>
            <p className="mt-2 text-xs text-slate-400">Queries fulfilled & answered</p>
          </div>

          {/* Card 3: Failed Calls */}
          <div className="relative group overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-slate-900/90 via-rose-950/20 to-slate-900/90 p-6 shadow-xl backdrop-blur-xl transition hover:border-rose-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">Early Hangups / Failed</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-lg text-rose-300">❌</span>
            </div>
            <div className="mt-4 text-4xl font-black tracking-tight text-rose-400">{data.failed_calls}</div>
            <p className="mt-2 text-xs text-slate-400">Incomplete or short disconnects</p>
          </div>

          {/* Card 4: Success Rate */}
          <div className="relative group overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900/90 via-purple-950/20 to-slate-900/90 p-6 shadow-xl backdrop-blur-xl transition hover:border-purple-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-400">Success Rate Target</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-lg text-purple-300">📈</span>
            </div>
            <div className="mt-4 text-4xl font-black tracking-tight text-purple-300">{data.success_rate}%</div>
            <p className="mt-2 text-xs text-slate-400">Goal: &gt;90% resolution rate</p>
          </div>
        </section>

        {/* Analytics Breakdown Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Query Breakdown */}
          <div className="lg:col-span-2 rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400">Call Categories & Inquiries</h3>
                <p className="text-xs text-slate-400 mt-0.5">Distribution of topics requested by farmers</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{Object.keys(data.query_breakdown).length} active topics</span>
            </div>

            {Object.keys(data.query_breakdown).length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No query categories recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(data.query_breakdown).map(([cat, count]) => {
                  const pct = data.total_calls > 0 ? Math.round((count / data.total_calls) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-200">
                        <span>{cat}</span>
                        <span className="font-mono text-emerald-400">{count} calls ({pct}%)</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Failure Reasons Breakdown */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300">Failure Diagnostics</h3>
              <p className="text-xs text-slate-400 mt-0.5">Reasons logged for failed sessions</p>
            </div>

            {Object.keys(data.failure_breakdown).length === 0 ? (
              <div className="py-10 text-center text-xs text-emerald-400 font-semibold">
                ✨ 0 Failure Errors Recorded! All calls succeeded.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.failure_breakdown).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                    <span className="text-xs font-semibold text-rose-300">{reason}</span>
                    <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 font-mono text-xs font-extrabold text-rose-400">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Detailed Call Telemetry Table Section */}
        <section className="rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl">
          {/* Table Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400">Detailed Call History Telemetry</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time session records logged by Murf Falcon & SQLite</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Box */}
              <input
                type="text"
                placeholder="Search call ID, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
                {(['ALL', 'SUCCESS', 'FAILED', 'BROWSER', 'SIP'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                      filter === f
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {filteredCalls.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No matching call logs found. Start a call from the home page to populate data!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Call ID / Channel</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Outcome Status</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCalls.map((c, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedCall(c)}
                      className="hover:bg-slate-800/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.channel === 'SIP' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {c.channel === 'SIP' ? '📞 SIP' : '🌐 Browser'}
                          </span>
                          <span className="text-slate-300 text-[11px] truncate max-w-[140px]">{c.call_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{c.query_type}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{c.duration_seconds}s</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${c.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                          {c.status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : 'Just now'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20">
                          Inspect 🔍
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Footer Privacy Guarantee Notice */}
        <footer className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span>
              <strong>Caller Privacy scrubbed & protected:</strong> All user PII, PINs, and transcripts strictly handled per Day 9 requirements.
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">Kisan Vani v1.0 • Day 10 Challenge</span>
        </footer>
      </main>

      {/* Inspector Modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 text-left shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="text-sm font-extrabold text-cyan-300">Call Telemetry Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Call Session ID:</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedCall.call_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Channel Type:</span>
                <span className="font-bold text-white">{selectedCall.channel}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Query Category:</span>
                <span className="font-bold text-emerald-400">{selectedCall.query_type}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Call Duration:</span>
                <span className="font-mono text-white">{selectedCall.duration_seconds} seconds</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Outcome Status:</span>
                <span className={`font-bold ${selectedCall.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedCall.status} ({selectedCall.failure_reason})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">User Profile:</span>
                <span className="font-mono text-slate-300">{selectedCall.user_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Tools Executed:</span>
                <pre className="rounded bg-slate-950 p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto border border-slate-800">
                  {selectedCall.tools_used || '[]'}
                </pre>
              </div>
            </div>

            <button
              onClick={() => setSelectedCall(null)}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 py-3 text-xs font-extrabold text-white shadow-lg hover:from-cyan-500 hover:to-teal-500 cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
