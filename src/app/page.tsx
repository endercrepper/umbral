'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/game/store';
import GameCanvas from '@/components/game/GameCanvas';
import HUD, { type HudStats } from '@/components/game/HUD';
import MainMenu from '@/components/game/MainMenu';
import Hub from '@/components/game/Hub';
import EndScreen from '@/components/game/EndScreen';
import PerkModal from '@/components/game/PerkModal';

export default function Home() {
  const phase = useGame((s) => s.phase);
  const pendingLevelUps = useGame((s) => s.pendingLevelUps);
  const [hud, setHud] = useState<HudStats | null>(null);

  // Keyboard shortcuts for consumables during raid
  useEffect(() => {
    if (phase !== 'raid') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        const idx = parseInt(e.code.slice(-1)) - 1;
        const consumables = hud?.consumables || [];
        if (idx < consumables.length) {
          window.dispatchEvent(
            new CustomEvent('umbral-consume', {
              detail: { uid: consumables[idx].uid },
            }),
          );
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, hud?.consumables]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-black relative">
      {phase === 'raid' && (
        <>
          <GameCanvas onStats={setHud} />
          <HUD stats={hud} />
        </>
      )}
      {phase === 'menu' && <MainMenu />}
      {phase === 'hub' && <Hub />}
      {(phase === 'extracted' || phase === 'dead') && <EndScreen />}
      {/* Perk selection modal — shown whenever pending level-ups exist AND not in raid */}
      {phase === 'hub' && pendingLevelUps > 0 && <PerkModal />}
    </main>
  );
}
