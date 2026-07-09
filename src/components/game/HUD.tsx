'use client';

import { Heart, Zap, Sword, Package, Crosshair, Skull } from 'lucide-react';

export interface HudStats {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  weaponName: string;
  weaponDurability: number;
  weaponMaxDurability: number;
  lootCount: number;
  lootValue: number;
  extractProgress: number;
  nearExtraction: boolean;
  kills: number;
  raidTime: number;
  consumables: { id: string; uid: string; name: string; color: string; qty: number; heal: number }[];
}

export default function HUD({ stats }: { stats: HudStats | null }) {
  if (!stats) return null;
  const extracting = !!stats.nearExtraction;

  const hpPct = (stats.hp / stats.maxHp) * 100;
  const stamPct = (stats.stamina / stats.maxStamina) * 100;
  const durPct = stats.weaponMaxDurability > 0 ? (stats.weaponDurability / stats.weaponMaxDurability) * 100 : 0;
  const timeStr = formatTime(stats.raidTime);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-mono text-stone-200">
      {/* Top-left: HP/Stamina */}
      <div className="absolute top-4 left-4 w-64 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Heart className="w-3.5 h-3.5 text-red-500" />
            <span className="text-red-300">SALUTE</span>
            <span className="ml-auto text-red-200 font-bold">{stats.hp}/{stats.maxHp}</span>
          </div>
          <div className="h-3 bg-black/70 border border-red-900/80 rounded-sm overflow-hidden shadow-lg">
            <div
              className="h-full bg-gradient-to-r from-red-800 via-red-600 to-red-500 transition-all duration-200"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-amber-300">VIGORE</span>
            <span className="ml-auto text-amber-200">{stats.stamina}</span>
          </div>
          <div className="h-2 bg-black/70 border border-amber-900/80 rounded-sm overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-100"
              style={{ width: `${stamPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top-right: Weapon + Stats */}
      <div className="absolute top-4 right-4 w-64 text-right space-y-2">
        <div className="bg-black/70 border border-stone-800 rounded-sm p-2 shadow-lg">
          <div className="flex items-center justify-end gap-2 text-xs">
            <Sword className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-200 font-bold tracking-wider">{stats.weaponName}</span>
          </div>
          <div className="mt-1 h-1.5 bg-black/80 border border-stone-900 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all ${
                durPct > 50 ? 'bg-emerald-600' : durPct > 20 ? 'bg-amber-600' : 'bg-red-600'
              }`}
              style={{ width: `${durPct}%` }}
            />
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Durabilità {stats.weaponDurability}/{stats.weaponMaxDurability}
          </div>
        </div>
        <div className="bg-black/70 border border-stone-800 rounded-sm p-2 text-xs">
          <div className="flex justify-between text-stone-300">
            <span className="flex items-center gap-1">
              <Skull className="w-3 h-3 text-red-400" /> Uccisioni
            </span>
            <span className="text-red-200 font-bold">{stats.kills}</span>
          </div>
          <div className="flex justify-between text-stone-300 mt-1">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3 text-amber-400" /> Bottino
            </span>
            <span className="text-amber-200 font-bold">{stats.lootCount} · {stats.lootValue} oro</span>
          </div>
          <div className="flex justify-between text-stone-400 mt-1">
            <span>Tempo</span>
            <span>{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Bottom-center: Consumables */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
        {stats.consumables.length === 0 ? (
          <div className="text-xs text-stone-500 italic px-3 py-2 bg-black/50 border border-stone-900 rounded">
            Nessun oggetto curativo
          </div>
        ) : (
          stats.consumables.map((c, idx) => (
            <button
              key={c.uid}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('umbral-consume', { detail: { uid: c.uid } }),
                );
              }}
              className="group relative px-3 py-2 bg-black/70 border border-stone-700 hover:border-stone-500 rounded-sm transition-all hover:bg-black/90"
              style={{ borderTopColor: c.color, borderTopWidth: 2 }}
            >
              <div className="text-[10px] text-stone-400">Q{idx + 1}</div>
              <div className="text-xs font-bold" style={{ color: c.color }}>
                {c.name}
              </div>
              <div className="text-[10px] text-emerald-300">+{c.heal} HP</div>
              <div className="absolute -top-2 -right-2 bg-stone-800 border border-stone-600 text-stone-200 text-xs px-1.5 rounded-full">
                {c.qty}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Bottom-left: Controls hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-stone-500 leading-tight">
        <div><span className="text-stone-400 font-bold">WASD</span> muoviti</div>
        <div><span className="text-stone-400 font-bold">Mouse</span> mira</div>
        <div><span className="text-stone-400 font-bold">Click</span> attacca</div>
        <div><span className="text-stone-400 font-bold">Shift</span> scatto</div>
        <div><span className="text-stone-400 font-bold">Q1-3</span> cura</div>
      </div>

      {/* Extraction progress */}
      {extracting && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-emerald-300 text-sm font-bold tracking-widest mb-2 animate-pulse">
            ESTRAZIONE IN CORSO
          </div>
          <div className="w-64 h-3 bg-black/80 border border-emerald-700 rounded-sm overflow-hidden mx-auto">
            <div
              className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 transition-all duration-100"
              style={{ width: `${stats.extractProgress * 100}%` }}
            />
          </div>
          <div className="text-emerald-500 text-xs mt-1">
            Non muoverti dal portale
          </div>
        </div>
      )}

      {/* Low HP vignette */}
      {hpPct < 30 && hpPct > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 200px 50px rgba(180,0,0,0.55)',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      )}

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <Crosshair className="w-5 h-5 text-stone-400/40" />
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
