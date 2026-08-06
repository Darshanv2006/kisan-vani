'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudSun, Sprout, Bug, Landmark, TrendingUp, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface BentoFeature {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  details: string[];
  metrics: string;
  color: string;
}

const BENTO_FEATURES: BentoFeature[] = [
  {
    id: 'weather',
    icon: CloudSun,
    title: 'Weather Forecast',
    subtitle: 'Hyper-local rainfall & climate alerts',
    details: [
      'Next 7-day humidity & temperature predictions',
      'Monsoon onset tracking for monsoon crops',
      'Extreme frost and storm warnings',
    ],
    metrics: '99.4% Accuracy',
    color: 'from-sky-500/20 to-blue-600/10',
  },
  {
    id: 'crop',
    icon: Sprout,
    title: 'Crop Advice',
    subtitle: 'Yield optimization & soil nutrient guides',
    details: [
      'Soil NPK balancing recommendations',
      'Irrigation scheduling based on soil moisture',
      'Sowing time windows for maximum market price',
    ],
    metrics: '14+ Major Crops',
    color: 'from-emerald-500/20 to-green-600/10',
  },
  {
    id: 'pest',
    icon: Bug,
    title: 'Pest Protection',
    subtitle: 'Instant pest diagnostic remedies',
    details: [
      'Visual leaf disease diagnosis',
      'Organic Neem & bio-pesticide spray recipes',
      'Locust swarm early detection alerts',
    ],
    metrics: '<15s Diagnosis',
    color: 'from-amber-500/20 to-orange-600/10',
  },
  {
    id: 'schemes',
    icon: Landmark,
    title: 'Govt Schemes',
    subtitle: 'Subsidies, PM-Kisan & insurance support',
    details: [
      'PM-Kisan Samman Nidhi installment checker',
      'Fasal Bima Yojana crop insurance claim guide',
      'Solar pump & drip irrigation subsidies',
    ],
    metrics: 'Direct Subsidy Links',
    color: 'from-purple-500/20 to-indigo-600/10',
  },
  {
    id: 'mandi',
    icon: TrendingUp,
    title: 'Mandi Prices',
    subtitle: 'Live regional market commodity rates',
    details: [
      'Real-time APMC Mandi rates across 500+ markets',
      'Price trend forecasting for Wheat, Paddy & Tomato',
      'Nearest high-demand market recommendations',
    ],
    metrics: 'Updated Hourly',
    color: 'from-lime-500/20 to-emerald-600/10',
  },
];

export function BentoGrid({ onSelectQuery }: { onSelectQuery: (query: string) => void }) {
  const [activeModal, setActiveModal] = useState<BentoFeature | null>(null);

  return (
    <section className="py-12 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-10 space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
          Core Capabilities
        </h3>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
          Engineered for <span className="text-gradient">Agricultural Precision</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {BENTO_FEATURES.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              onClick={() => setActiveModal(feature)}
              className="glass-panel glass-panel-hover p-6 rounded-2xl cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-lime-400" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white group-hover:text-lime-300 transition-colors">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1 leading-snug">
                    {feature.subtitle}
                  </p>
                </div>
              </div>

              <div className="relative z-10 pt-4 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                <span>{feature.metrics}</span>
                <span className="group-hover:translate-x-1 transition-transform">Explore →</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Detail Modal Drawer */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-panel p-6 rounded-3xl border-emerald-500/40 relative shadow-2xl"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  {(() => {
                    const ModalIcon = activeModal.icon;
                    return <ModalIcon className="w-5 h-5 text-lime-400" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">{activeModal.title}</h3>
                  <p className="text-xs text-emerald-400 font-semibold">{activeModal.metrics}</p>
                </div>
              </div>

              <div className="space-y-3 my-6">
                {activeModal.details.map((detail, index) => (
                  <div key={index} className="flex items-start gap-2.5 text-sm text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-emerald-500/20 flex gap-3">
                <button
                  onClick={() => {
                    onSelectQuery(`Give me a detailed guide regarding ${activeModal.title} for my crops today.`);
                    setActiveModal(null);
                    const consoleElem = document.getElementById('voice-console-section');
                    consoleElem?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 text-slate-950 font-bold text-xs shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ask AI Voice Agent Now</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
