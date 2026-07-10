'use client';

import { useGame } from '@/game/store';
import { TIER_LABEL, TIER_COLOR } from '@/game/weapons';

export default function MainMenu() {
  const setPhase = useGame((s) => s.setPhase);
  const reset = useGame((s) => s.reset);
  const totalRaids = useGame((s) => s.totalRaids);
  const successfulExtractions = useGame((s) => s.successfulExtractions);
  const deaths = useGame((s) => s.deaths);
  const bestRaidValue = useGame((s) => s.bestRaidValue);
  const stats = { totalRaids, successfulExtractions, deaths, bestRaidValue };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black overflow-hidden">
      {/* Background atmosphere */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, #1a0a14 0%, #050208 60%, #000 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,80,40,0.04) 2px, rgba(255,80,40,0.04) 3px)`,
        }}
      />

      <div className="relative z-10 text-center px-8 max-w-2xl">
        {/* Title */}
        <div className="mb-2 text-stone-500 text-xs tracking-[0.4em] uppercase">
          Extraction Looter · Hardcore
        </div>
        <h1
          className="text-7xl md:text-8xl font-black mb-3 tracking-tight"
          style={{
            background: 'linear-gradient(180deg, #f4e4c1 0%, #c08540 50%, #6b3010 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 60px rgba(255,80,40,0.3)',
            fontFamily: 'serif',
          }}
        >
          UMBRAL
        </h1>
        <div className="text-stone-400 italic text-sm md:text-base mb-8 leading-relaxed max-w-lg mx-auto">
          «Le profondità custodiscono armi di epoche perdute. Estrai ciò che puoi.
          Muori, e tutto sarà inghiottito dalle tenebre.»
        </div>

        {/* Stats summary */}
        {(stats.totalRaids > 0 || stats.deaths > 0) && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Stat label="Raid Totali" value={stats.totalRaids} color="text-stone-300" />
            <Stat label="Estrazioni" value={stats.successfulExtractions} color="text-emerald-400" />
            <Stat label="Morti" value={stats.deaths} color="text-red-400" />
            <Stat label="Miglior Bottino" value={`${stats.bestRaidValue} oro`} color="text-amber-400" />
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setPhase('hub')}
            className="group relative px-12 py-4 bg-gradient-to-b from-stone-800 to-stone-950 border-2 border-amber-900/70 hover:border-amber-600 text-amber-200 text-lg font-bold tracking-widest uppercase transition-all hover:from-stone-700 hover:to-stone-900 shadow-lg shadow-amber-900/20"
          >
            <span className="relative z-10">Entra nel Sanctum</span>
            <div className="absolute inset-0 bg-gradient-to-t from-amber-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={() => {
              if (confirm('Iniziare una NUOVA partita? Tutti i progressi andranno persi.')) {
                reset();
              }
            }}
            className="text-stone-500 hover:text-stone-300 text-xs tracking-widest uppercase transition-colors"
          >
            Nuova Partita
          </button>
        </div>

        {/* Tier showcase */}
        <div className="mt-12">
          <div className="text-stone-500 text-[10px] tracking-[0.3em] uppercase mb-3">
            Epoche delle Armi
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {(Object.keys(TIER_LABEL) as Array<keyof typeof TIER_LABEL>).map((tier) => (
              <div key={tier} className="text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-1 shadow-lg"
                  style={{
                    backgroundColor: TIER_COLOR[tier],
                    boxShadow: `0 0 12px ${TIER_COLOR[tier]}`,
                  }}
                />
                <div className="text-[10px] text-stone-400 tracking-wider">
                  {TIER_LABEL[tier]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-stone-700 text-[10px] tracking-widest">
          WebGL · Single Player · Permadeath
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="border border-stone-900 bg-black/40 px-3 py-2">
      <div className="text-stone-500 text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
