'use client';

import { useGame } from '@/game/store';
import { Skull, CheckCircle2, Coins, Heart, Timer, Swords, Package } from 'lucide-react';

export default function EndScreen() {
  const phase = useGame((s) => s.phase);
  const stats = useGame((s) => s.lastRunStats);
  const setPhase = useGame((s) => s.setPhase);

  if (!stats) {
    return null;
  }

  const isDeath = phase === 'dead';
  const time = formatTime(stats.timeAlive);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/95 backdrop-blur-sm overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: isDeath
            ? 'radial-gradient(circle at 50% 40%, #2a0a0a 0%, #0a0202 60%, #000 100%)'
            : 'radial-gradient(circle at 50% 40%, #0a2a18 0%, #02100a 60%, #000 100%)',
        }}
      />
      {/* Atmospheric noise */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${
            isDeath ? 'rgba(180,30,30,0.06)' : 'rgba(30,180,80,0.06)'
          } 2px, ${isDeath ? 'rgba(180,30,30,0.06)' : 'rgba(30,180,80,0.06)'} 3px)`,
        }}
      />

      <div className="relative z-10 text-center px-8 max-w-xl">
        {/* Big icon */}
        <div className="mb-4 flex justify-center">
          {isDeath ? (
            <Skull
              className="w-24 h-24 text-red-600"
              style={{ filter: 'drop-shadow(0 0 30px rgba(200,30,30,0.6))' }}
            />
          ) : (
            <CheckCircle2
              className="w-24 h-24 text-emerald-500"
              style={{ filter: 'drop-shadow(0 0 30px rgba(30,200,80,0.6))' }}
            />
          )}
        </div>

        <h1
          className="text-6xl md:text-7xl font-black tracking-widest mb-2"
          style={{
            color: isDeath ? '#b02020' : '#3aee80',
            textShadow: `0 0 40px ${isDeath ? 'rgba(180,30,30,0.5)' : 'rgba(30,200,80,0.5)'}`,
            fontFamily: 'serif',
          }}
        >
          {isDeath ? 'MORTO' : 'ESTRATTO'}
        </h1>

        <div className="text-stone-400 italic text-sm mb-8 max-w-md mx-auto">
          {isDeath
            ? "«Le profondità hanno preteso la tua vita. Il bottino è perduto, l'arma spezzata. Solo la memoria resta.»"
            : '«Hai sfidato le profondità e sei tornato. Il bottino è al sicuro nel sanctum.»'}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-8">
          <StatCard
            icon={<Timer className="w-3.5 h-3.5" />}
            label="Sopravvissuto"
            value={time}
            color="text-stone-300"
          />
          <StatCard
            icon={<Timer className="w-3.5 h-3.5" />}
            label="Turni Giocati"
            value={stats.turnsPlayed || 0}
            color="text-amber-300"
          />
          <StatCard
            icon={<Skull className="w-3.5 h-3.5" />}
            label="Uccisioni"
            value={stats.kills}
            color="text-red-300"
          />
          <StatCard
            icon={<Swords className="w-3.5 h-3.5" />}
            label="Danno Inflitto"
            value={stats.damageDealt}
            color="text-amber-300"
          />
          <StatCard
            icon={<Heart className="w-3.5 h-3.5" />}
            label="Danno Subito"
            value={stats.damageTaken}
            color="text-red-400"
          />
          <StatCard
            icon={<Coins className="w-3.5 h-3.5" />}
            label="Valore Bottino"
            value={`${stats.lootValue} oro`}
            color={isDeath ? 'text-stone-600' : 'text-amber-300'}
            struck={isDeath}
          />
          <StatCard
            icon={<Package className="w-3.5 h-3.5" />}
            label={isDeath ? 'Bottino Perduto' : 'Bottino Salvata'}
            value={isDeath ? 'PERSO' : 'OK'}
            color={isDeath ? 'text-red-500' : 'text-emerald-400'}
          />
        </div>

        {isDeath && (
          <div className="mb-6 px-4 py-3 border border-red-900 bg-red-950/30 rounded text-red-300 text-xs italic">
            Il tuo equipaggiamento è stato perso. Una nuova arma di selce è stata fornita.
          </div>
        )}

        <button
          onClick={() => setPhase('hub')}
          className="px-10 py-3 bg-gradient-to-b from-stone-800 to-stone-950 border-2 border-amber-900 hover:border-amber-600 text-amber-200 text-sm font-bold tracking-widest uppercase transition-all shadow-lg"
        >
          Torna al Sanctum
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  struck,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  struck?: boolean;
}) {
  return (
    <div className="border border-stone-900 bg-black/50 p-2.5 rounded">
      <div className="text-stone-600 text-[10px] uppercase tracking-wider flex items-center gap-1 justify-center">
        {icon}
        {label}
      </div>
      <div
        className={`text-lg font-bold ${color} ${struck ? 'line-through' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
