'use client';

import { useState, useMemo } from 'react';
import { useGame } from '@/game/store';
import { PERKS } from '@/game/types';
import type { Perk } from '@/game/types';
import { Sword, Wind, Target, Heart, Shield, Eye, Hammer, Flame, X } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  sword: <Sword className="w-6 h-6" />,
  wind: <Wind className="w-6 h-6" />,
  target: <Target className="w-6 h-6" />,
  heart: <Heart className="w-6 h-6" />,
  shield: <Shield className="w-6 h-6" />,
  eye: <Eye className="w-6 h-6" />,
  hammer: <Hammer className="w-6 h-6" />,
  flame: <Flame className="w-6 h-6" />,
};

const STAT_LABEL: Record<string, string> = {
  might: 'Vigor',
  agility: 'Agilità',
  vitality: 'Vitalità',
  focus: 'Focus',
};

const STAT_COLOR: Record<string, string> = {
  might: '#ff8844',
  agility: '#fbbf24',
  vitality: '#4ade80',
  focus: '#38bdf8',
};

export default function PerkModal() {
  const applyPerk = useGame((s) => s.applyPerk);
  const pendingLevelUps = useGame((s) => s.pendingLevelUps);
  const ownedPerks = useGame((s) => s.perks);

  // Pick 3 random perks not yet owned
  const choices = useMemo<Perk[]>(() => {
    const available = PERKS.filter((p) => !ownedPerks.includes(p.id));
    if (available.length === 0) return PERKS.slice(0, 3);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [pendingLevelUps, ownedPerks]);

  const [picked, setPicked] = useState<string | null>(null);

  const handlePick = (perkId: string) => {
    setPicked(perkId);
    setTimeout(() => {
      applyPerk(perkId);
      setPicked(null);
    }, 350);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="relative max-w-3xl w-full mx-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-amber-500 text-xs tracking-[0.4em] uppercase mb-2">
            Livello Superato
          </div>
          <h2
            className="text-5xl font-black tracking-widest mb-2"
            style={{
              background: 'linear-gradient(180deg, #f4e4c1 0%, #c08540 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'serif',
            }}
          >
            SCELTA DEL PERK
          </h2>
          <div className="text-stone-400 italic text-sm">
            Scegli un dono per forgiare il tuo destino.
            {pendingLevelUps > 1 && (
              <span className="block text-amber-400 text-xs mt-1">
                Perk rimanenti da sbloccare: {pendingLevelUps}
              </span>
            )}
          </div>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {choices.map((perk) => {
            const isPicked = picked === perk.id;
            const color = STAT_COLOR[perk.stat];
            return (
              <button
                key={perk.id}
                onClick={() => handlePick(perk.id)}
                className={`group relative p-5 border-2 rounded transition-all text-left hover:scale-105 ${
                  isPicked ? 'scale-105 bg-amber-950/40' : 'bg-black/60'
                }`}
                style={{
                  borderColor: color,
                  boxShadow: `0 0 24px ${color}30`,
                }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3 border-2"
                  style={{
                    color,
                    borderColor: color,
                    backgroundColor: color + '20',
                  }}
                >
                  {ICONS[perk.icon] || <Sword className="w-6 h-6" />}
                </div>
                {/* Name */}
                <div
                  className="text-lg font-bold mb-1 tracking-wider"
                  style={{ color }}
                >
                  {perk.name}
                </div>
                {/* Stat */}
                <div className="text-[10px] text-stone-500 mb-2 uppercase tracking-widest">
                  {STAT_LABEL[perk.stat]} +{perk.bonus}
                  {perk.stat === 'agility' && perk.id === 'swift' ? ' AP' : ''}
                  {perk.stat === 'vitality' ? ' HP' : ''}
                  {perk.stat === 'might' || perk.stat === 'focus' ? ' %' : ''}
                </div>
                {/* Description */}
                <div className="text-xs text-stone-300 leading-relaxed">
                  {perk.description}
                </div>
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)`,
                  }}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-6 text-center text-stone-600 text-[10px] tracking-widest uppercase">
          Clicca per scegliere · La scelta è definitiva
        </div>
      </div>
    </div>
  );
}
