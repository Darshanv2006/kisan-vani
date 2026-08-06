'use client';

import { Heart, Globe, Share2, MessageSquare } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-8 px-6 border-t border-emerald-500/20 bg-[#020704] text-slate-400 text-xs font-semibold">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-white font-extrabold">🌾 Kisan Vani</span>
          <span>• Powered by Murf Falcon 2 TTS</span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <span>Made with</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>for Bharat Farmers</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <a href="#" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Globe className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <a href="#" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Share2 className="w-4 h-4" />
            <span>LinkedIn</span>
          </a>
          <a href="#" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            <span>Discord</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
