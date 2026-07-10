'use client';

import { Heart, Zap, Sword, Package, Crosshair, Skull, Clock, Sparkles, ScrollText, FastForward } from 'lucide-react';

export interface HudStats {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  currentTurn: 'player' | 'enemy';
  turnCount: number;
  weaponName: string;
  weaponApCost: number;
  weaponDurability: number;
  weaponMaxDurability: number;
  lootCount: number;
  lootValue: number;
  extractProgress: number;
  nearExtraction: boolean;
  kills: number;
  raidTime: number;
  actionLog: { text: string; color: string; turn: number }[];
  consumables: { id: string; uid: string; name: string; color: string; qty: number; heal: number }[];
  mightBonus: number;
  critChance: number;
  isAnimating: boolean;
}

export default function HUD({ stats }: { stats: HudStats | null }) {
  if (!stats) return null;

  const hpPct = (stats.hp / stats.maxHp) * 100;
  const durPct = stats.weaponMaxDurability > 0 ? (stats.weaponDurability / stats.weaponMaxDurability) * 100 : 0;
  const isPlayerTurn = stats.currentTurn === 'player';
  const timeStr = formatTime(stats.raidTime);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-mono text-stone-200">
      {/* Turn banner (top center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div
          className={`px-4 py-1.5 border-2 rounded-sm shadow-lg flex items-center gap-2 ${
            isPlayerTurn
              ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
              : 'border-red-800 bg-red-950/60 text-red-300'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isPlayerTurn ? 'bg-emerald-400 animate-pulse' : 'bg-red-400 animate-pulse'
            }`}
          />
          <span className="text-xs tracking-widest font-bold uppercase">
            {isPlayerTurn ? 'Tuo Turno' : 'Turno Nemici'}
          </span>
          <span className="text-[10px] opacity-60">· T{stats.turnCount}</span>
          <span className="text-[10px] opacity-60">· {timeStr}</span>
        </div>
      </div>

      {/* Top-left: HP/AP */}
      <div className="absolute top-4 left-4 w-72 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Heart className="w-3.5 h-3.5 text-red-500" />
            <span className="text-red-300">SALUTE</span>
            <span className="ml-auto text-red-200 font-bold">{stats.hp}/{stats.maxHp}</span>
          </div>
          <div className="h-3.5 bg-black/70 border border-red-900/80 rounded-sm overflow-hidden shadow-lg">
            <div
              className="h-full bg-gradient-to-r from-red-800 via-red-600 to-red-500 transition-all duration-200"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        {/* AP dots */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300">AZIONI</span>
            <span className="ml-auto text-amber-200 font-bold">{stats.ap}/{stats.maxAp}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: stats.maxAp }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-3.5 rounded-sm border transition-all ${
                  i < stats.ap
                    ? 'bg-amber-500 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-black/60 border-stone-800'
                }`}
              />
            ))}
          </div>
        </div>
        {/* Secondary stats */}
        <div className="flex gap-3 text-[10px] pt-1">
          {stats.mightBonus > 0 && (
            <div className="flex items-center gap-1 text-orange-300">
              <Sword className="w-2.5 h-2.5" />
              <span>+{stats.mightBonus}%</span>
            </div>
          )}
          {stats.critChance > 0 && (
            <div className="flex items-center gap-1 text-yellow-300">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Crit {stats.critChance}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Top-right: Weapon + stats */}
      <div className="absolute top-4 right-4 w-64 text-right space-y-2">
        <div className="bg-black/70 border border-stone-800 rounded-sm p-2 shadow-lg">
          <div className="flex items-center justify-end gap-2 text-xs">
            <Sword className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-200 font-bold tracking-wider">{stats.weaponName}</span>
          </div>
          <div className="flex justify-end gap-2 text-[10px] text-stone-500 mt-0.5">
            <span className="text-amber-400 font-bold">{stats.weaponApCost} AP</span>
            <span>·</span>
            <span>portata armi</span>
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
        </div>
      </div>

      {/* Right side: Action log */}
      <div className="absolute top-32 right-4 w-64 bg-black/60 border border-stone-900 rounded-sm p-2 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-widest mb-1">
          <ScrollText className="w-3 h-3" />
          <span>Cronaca</span>
        </div>
        <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scroll">
          {stats.actionLog.length === 0 ? (
            <div className="text-[10px] text-stone-600 italic">In attesa di azioni...</div>
          ) : (
            stats.actionLog.map((entry, i) => (
              <div
                key={i}
                className="text-[10px] leading-tight flex gap-1.5"
                style={{ opacity: 1 - i * 0.1 }}
              >
                <span className="text-stone-600 shrink-0">T{entry.turn}</span>
                <span style={{ color: entry.color }}>{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom-center: Consumables + End Turn */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex gap-2 pointer-events-auto">
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
                disabled={!isPlayerTurn || stats.ap < 1 || stats.isAnimating}
                className="group relative px-3 py-2 bg-black/70 border border-stone-700 hover:border-stone-500 rounded-sm transition-all hover:bg-black/90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderTopColor: c.color, borderTopWidth: 2 }}
              >
                <div className="text-[10px] text-stone-400">Q{idx + 1} · 1 AP</div>
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
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('umbral-end-turn'))}
          disabled={!isPlayerTurn || stats.isAnimating}
          className="pointer-events-auto px-6 py-2 bg-gradient-to-b from-stone-800 to-stone-950 border border-amber-900 hover:border-amber-600 text-amber-200 text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
        >
          <FastForward className="w-3 h-3" />
          Fine Turno · Spazio
        </button>
      </div>

      {/* Bottom-left: Controls hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-stone-500 leading-tight">
        <div><span className="text-stone-400 font-bold">WASD</span> muovi (1 AP)</div>
        <div><span className="text-stone-400 font-bold">Mouse</span> mira</div>
        <div><span className="text-stone-400 font-bold">Click</span> attacca ({stats.weaponApCost} AP)</div>
        <div><span className="text-stone-400 font-bold">Spazio</span> attesa/fine turno</div>
        <div><span className="text-stone-400 font-bold">Q1-3</span> usa curativo</div>
      </div>

      {/* Extraction progress */}
      {stats.nearExtraction && (
        <div className="absolute top-1/2 left-4 -translate-y-1/2 text-center w-56">
          <div className="text-emerald-300 text-xs font-bold tracking-widest mb-2 animate-pulse">
            ESTRAZIONE
          </div>
          <div className="flex gap-1.5 justify-center mb-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded border-2 ${
                  i < stats.extractProgress * 3
                    ? 'bg-emerald-500 border-emerald-300'
                    : 'bg-black/60 border-stone-700'
                }`}
              />
            ))}
          </div>
          <div className="text-emerald-500 text-[10px]">
            Resta sul portale 3 turni
          </div>
        </div>
      )}

      {/* Enemy turn overlay */}
      {!isPlayerTurn && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 100px 20px rgba(180,0,0,0.25)',
          }}
        />
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
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #3a2a1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
