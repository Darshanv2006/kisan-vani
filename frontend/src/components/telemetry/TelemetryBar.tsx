'use client';

import { useState, useEffect } from 'react';
import { Server, Cpu, Clock, Globe } from 'lucide-react';

interface TelemetryBarProps {
  selectedVoice: string;
}

export function TelemetryBar({ selectedVoice }: TelemetryBarProps) {
  const [murfConnected, setMurfConnected] = useState<boolean>(true);
  const [engineName, setEngineName] = useState<string>('Falcon 2');

  useEffect(() => {
    fetch('http://localhost:8000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setMurfConnected(data.murf_connected);
        if (data.engine) setEngineName(data.engine);
      })
      .catch(() => setMurfConnected(false));
  }, []);

  return (
    <section className="py-6 px-6 max-w-7xl mx-auto">
      <div className="glass-panel p-4 rounded-2xl border-emerald-500/25 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#040D07]/60 border border-emerald-500/20">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              murfConnected ? 'bg-emerald-400 animate-pulse shadow-md shadow-emerald-400' : 'bg-amber-400'
            }`}
          />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Murf API</div>
            <div className={`text-xs font-mono font-bold ${murfConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {murfConnected ? 'CONNECTED' : 'STANDBY'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#040D07]/60 border border-emerald-500/20">
          <Server className="w-4 h-4 text-lime-400" />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Voice Engine</div>
            <div className="text-xs font-mono font-bold text-white">{engineName}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#040D07]/60 border border-emerald-500/20">
          <Cpu className="w-4 h-4 text-sky-400" />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agri Agent</div>
            <div className="text-xs font-mono font-bold text-sky-400">ONLINE</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#040D07]/60 border border-emerald-500/20">
          <Clock className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Target Latency</div>
            <div className="text-xs font-mono font-bold text-amber-400">&lt;100 ms</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#040D07]/60 border border-emerald-500/20 col-span-2 sm:col-span-1">
          <Globe className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Voice</div>
            <div className="text-xs font-mono font-bold text-white truncate max-w-[120px]">
              {selectedVoice.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
