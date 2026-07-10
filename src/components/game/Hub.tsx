'use client';

import { useState } from 'react';
import { useGame, getDerivedStats } from '@/game/store';
import { WEAPON_MAP, TIER_LABEL, TIER_COLOR, RARITY_LABEL, RARITY_COLOR } from '@/game/weapons';
import { CONSUMABLES } from '@/game/enemies';
import { PERKS } from '@/game/types';
import { Swords, Backpack, Coins, Skull, LogOut, ShoppingBag, Heart, Plus, Sparkles, Zap, Shield, Eye } from 'lucide-react';

const STAT_ICON: Record<string, React.ReactNode> = {
  might: <Swords className="w-3.5 h-3.5 text-orange-400" />,
  agility: <Zap className="w-3.5 h-3.5 text-amber-400" />,
  vitality: <Shield className="w-3.5 h-3.5 text-emerald-400" />,
  focus: <Eye className="w-3.5 h-3.5 text-sky-400" />,
};

const STAT_LABEL: Record<string, string> = {
  might: 'Vigor',
  agility: 'Agilità',
  vitality: 'Vitalità',
  focus: 'Focus',
};

export default function Hub() {
  const stash = useGame((s) => s.stash);
  const equippedUid = useGame((s) => s.equippedWeaponUid);
  const equip = useGame((s) => s.equipWeapon);
  const removeFromStash = useGame((s) => s.removeFromStash);
  const startRaid = useGame((s) => s.startRaid);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const gold = useGame((s) => s.gold);
  const level = useGame((s) => s.level);
  const xp = useGame((s) => s.xp);
  const carriedConsumables = useGame((s) => s.carriedConsumables);
  const buyStarterWeapon = useGame((s) => s.buyStarterWeapon);
  const addConsumable = useGame((s) => s.addConsumable);
  const spendGold = useGame((s) => s.spendGold);
  const log = useGame((s) => s.log);
  const baseStats = useGame((s) => s.baseStats);
  const perks = useGame((s) => s.perks);
  const pendingLevelUps = useGame((s) => s.pendingLevelUps);

  const derived = getDerivedStats(baseStats, level);
  const ownedPerks = perks.map((id) => PERKS.find((p) => p.id === id)).filter(Boolean);

  const [tab, setTab] = useState<'stash' | 'shop' | 'log'>('stash');

  const equipped = stash.find((w) => w.uid === equippedUid);
  const equippedDef = equipped ? WEAPON_MAP[equipped.defId] : null;

  const diffOptions = [
    { v: 1, name: 'Profondità Minori', desc: 'Per inesperti. Nemici deboli, poco bottino.' },
    { v: 2, name: 'Catacombe', desc: 'Sventure moderate. Bottino migliorato.' },
    { v: 3, name: 'Cripte Profonde', desc: 'Pericoloso. Equipaggiamento medievale.' },
    { v: 4, name: 'Abisso', desc: 'Per esperti. Armi rinascimentali, morte certa.' },
    { v: 5, name: 'Voragine del Signore', desc: 'Leggendario. Solo il coraggioso osa.' },
  ];

  const shopConsumables = [
    { id: 'herb', cost: 15 },
    { id: 'potion', cost: 45 },
    { id: 'elixir', cost: 120 },
  ];

  return (
    <div className="absolute inset-0 z-30 bg-black text-stone-200 font-mono overflow-hidden flex flex-col">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 30% 40%, #1a0a08 0%, #0a0506 60%, #000 100%)',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-stone-900/80 bg-black/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2
              className="text-2xl font-black tracking-widest"
              style={{
                background: 'linear-gradient(180deg, #f4e4c1 0%, #c08540 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SANCTUM
            </h2>
            <div className="text-[10px] text-stone-500 tracking-widest uppercase">
              rifugio del cacciatore
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              <span className="font-bold">{gold}</span>
              <span className="text-stone-500">oro</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-300">
              <span className="text-stone-500">Lv</span>
              <span className="font-bold text-amber-200">{level}</span>
              <span className="text-stone-600 text-[10px]">({xp % 100}/100 XP)</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0 overflow-hidden">
          {/* Left: Tabs content */}
          <div className="overflow-hidden flex flex-col border-r border-stone-900/60">
            {/* Tab header */}
            <div className="flex border-b border-stone-900/80 bg-black/40">
              <TabButton active={tab === 'stash'} onClick={() => setTab('stash')} icon={<Backpack className="w-3.5 h-3.5" />}>
                Stash
              </TabButton>
              <TabButton active={tab === 'shop'} onClick={() => setTab('shop')} icon={<ShoppingBag className="w-3.5 h-3.5" />}>
                Mercante
              </TabButton>
              <TabButton active={tab === 'log'} onClick={() => setTab('log')} icon={<LogOut className="w-3.5 h-3.5" />}>
                Cronaca
              </TabButton>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scroll">
              {tab === 'stash' && (
                <StashView
                  stash={stash}
                  equippedUid={equippedUid}
                  onEquip={equip}
                  onDiscard={removeFromStash}
                />
              )}
              {tab === 'shop' && (
                <ShopView
                  gold={gold}
                  onBuyWeapon={(tier) => buyStarterWeapon(tier as any)}
                  onBuyConsumable={(id, cost) => {
                    if (spendGold(cost)) addConsumable(id, 1);
                  }}
                  shopConsumables={shopConsumables}
                />
              )}
              {tab === 'log' && (
                <div className="space-y-1 text-xs font-mono">
                  {log.slice().reverse().map((l, i) => (
                    <div
                      key={i}
                      className={`px-3 py-1.5 border-l-2 ${
                        i === 0
                          ? 'border-amber-600 bg-amber-950/20 text-amber-200'
                          : 'border-stone-800 text-stone-400'
                      }`}
                    >
                      <span className="text-stone-600 mr-2">›</span>
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Raid prep panel */}
          <aside className="bg-black/50 backdrop-blur-sm overflow-y-auto custom-scroll p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" /> Arma Equipaggiata
              </h3>
              {equippedDef ? (
                <div
                  className="border-2 rounded p-3"
                  style={{
                    borderColor: RARITY_COLOR[equippedDef.rarity],
                    background: 'rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="text-lg font-bold mb-1"
                    style={{ color: RARITY_COLOR[equippedDef.rarity] }}
                  >
                    {equippedDef.name}
                  </div>
                  <div className="text-[10px] text-stone-500 mb-2">
                    {TIER_LABEL[equippedDef.tier]} · {RARITY_LABEL[equippedDef.rarity]} · {equippedDef.class}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <Stat label="Danno" value={equippedDef.damage} />
                    <Stat label="Tipo" value={equippedDef.apCost === 1 ? 'Veloce' : equippedDef.apCost === 2 ? 'Media' : 'Pesante'} />
                    <Stat label="Portata" value={equippedDef.range.toFixed(1)} />
                    <Stat label="Vel" value={equippedDef.attackSpeed.toFixed(1)} />
                  </div>
                  <div className="mt-2 text-[10px] text-stone-400 italic">
                    {equippedDef.description}
                  </div>
                  <div className="mt-2 h-1.5 bg-black border border-stone-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-600"
                      style={{
                        width: `${((equipped?.durability || 0) / (equipped?.maxDurability || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-stone-800 rounded p-4 text-center text-stone-600 text-sm">
                  Nessuna arma equipaggiata.
                  <br />
                  <span className="text-stone-500">Selezionane una dallo stash.</span>
                </div>
              )}
            </div>

            {/* Consumables */}
            <div>
              <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
                <Heart className="w-4 h-4" /> Curativi Portati
              </h3>
              <div className="space-y-1">
                {carriedConsumables.length === 0 ? (
                  <div className="text-xs text-stone-600 italic px-2 py-1.5">
                    Nessuno. Compra dal mercante.
                  </div>
                ) : (
                  carriedConsumables.map((c) => {
                    const def = CONSUMABLES[c.defId];
                    if (!def) return null;
                    return (
                      <div
                        key={c.uid}
                        className="flex items-center gap-2 px-2 py-1.5 bg-black/60 border border-stone-900 rounded text-xs"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: def.color }}
                        />
                        <span className="flex-1 text-stone-200">{def.name}</span>
                        <span className="text-emerald-400">+{def.healAmount} HP</span>
                        <span className="text-stone-400 font-bold">×{c.qty}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Difficulty selector */}
            <div>
              <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
                <Skull className="w-4 h-4" /> Profondità
              </h3>
              <div className="space-y-1">
                {diffOptions.map((d) => (
                  <button
                    key={d.v}
                    onClick={() => setDifficulty(d.v)}
                    className={`w-full text-left px-3 py-2 border rounded transition-all ${
                      difficulty === d.v
                        ? 'border-amber-700 bg-amber-950/40'
                        : 'border-stone-900 bg-black/40 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          d.v <= 1 ? 'bg-emerald-600' : d.v <= 2 ? 'bg-amber-600' : d.v <= 3 ? 'bg-orange-600' : 'bg-red-600'
                        }`}
                      />
                      <span
                        className={`text-sm font-bold ${
                          difficulty === d.v ? 'text-amber-200' : 'text-stone-300'
                        }`}
                      >
                        {d.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Player stats (perks) */}
            <div>
              <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Attributi
              </h3>
              {pendingLevelUps > 0 && (
                <div className="mb-2 px-2 py-2 border border-amber-600 bg-amber-950/40 rounded text-xs text-amber-300 animate-pulse">
                  ✦ {pendingLevelUps} perk da sbloccare! Chiudi questo pannello per scegliere.
                </div>
              )}
              <div className="grid grid-cols-2 gap-1 text-xs">
                {(['might', 'agility', 'vitality', 'focus'] as const).map((stat) => (
                  <div
                    key={stat}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-black/50 border border-stone-900 rounded"
                  >
                    {STAT_ICON[stat]}
                    <span className="text-stone-400">{STAT_LABEL[stat]}</span>
                    <span className="ml-auto text-stone-200 font-bold">
                      {baseStats[stat]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-stone-500 leading-relaxed space-y-0.5">
                <div>HP massimi: <span className="text-emerald-400">{derived.maxHp}</span></div>
                <div>Azione per turno: <span className="text-amber-400">1</span></div>
                {derived.critChance > 0 && (
                  <div>Critico: <span className="text-yellow-400">{derived.critChance}%</span></div>
                )}
                {derived.mightBonus > 0 && (
                  <div>Bonus mischia: <span className="text-orange-400">+{derived.mightBonus}%</span></div>
                )}
              </div>
              {/* Owned perks */}
              {ownedPerks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {ownedPerks.map((p) => p && (
                    <span
                      key={p.id}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-900/70 border border-stone-700 rounded text-stone-300"
                      title={p.description}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Launch raid */}
            <button
              disabled={!equippedDef}
              onClick={() => startRaid(difficulty)}
              className="w-full py-4 bg-gradient-to-b from-red-900 to-red-950 border-2 border-red-800 hover:border-red-600 text-red-100 font-bold tracking-widest uppercase text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-950/50"
            >
              ⚔ Discesa nelle Profondità ⚔
            </button>
            {!equippedDef && (
              <div className="text-[10px] text-red-500 text-center -mt-2">
                Equipaggia un'arma prima di scendere
              </div>
            )}

            <div className="text-[10px] text-stone-600 text-center mt-1 italic">
              «La morte perde ogni bottino trasportato.
              <br />
              Solo l'estrazione preserva il saccheggio.»
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #0a0a0a;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #3a2a1a;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs tracking-widest uppercase transition-all border-b-2 ${
        active
          ? 'border-amber-600 text-amber-200 bg-black/40'
          : 'border-transparent text-stone-500 hover:text-stone-300'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-stone-400">
      <span>{label}</span>
      <span className="text-stone-200 font-bold">{value}</span>
    </div>
  );
}

function StashView({
  stash,
  equippedUid,
  onEquip,
  onDiscard,
}: {
  stash: any[];
  equippedUid: string | null;
  onEquip: (uid: string) => void;
  onDiscard: (uid: string) => void;
}) {
  if (stash.length === 0) {
    return (
      <div className="text-center text-stone-600 italic py-8">
        Stash vuoto. Estrai bottino dalle profondità.
      </div>
    );
  }
  // Sort by tier then rarity
  const tierOrder = ['neolithic', 'bronze', 'iron', 'medieval', 'renaissance'];
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const sorted = [...stash].sort((a, b) => {
    const wa = WEAPON_MAP[a.defId];
    const wb = WEAPON_MAP[b.defId];
    if (!wa || !wb) return 0;
    const td = tierOrder.indexOf(wa.tier) - tierOrder.indexOf(wb.tier);
    if (td !== 0) return td;
    return rarityOrder.indexOf(wa.rarity) - rarityOrder.indexOf(wb.rarity);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {sorted.map((item) => {
        if (item.type === 'weapon') {
          const def = WEAPON_MAP[item.defId];
          if (!def) return null;
          const isEquipped = item.uid === equippedUid;
          return (
            <div
              key={item.uid}
              className={`relative border-2 rounded p-3 transition-all ${
                isEquipped ? 'bg-amber-950/30' : 'bg-black/40'
              }`}
              style={{ borderColor: RARITY_COLOR[def.rarity] }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center border"
                  style={{
                    backgroundColor: def.color + '30',
                    borderColor: def.color,
                  }}
                >
                  <Swords className="w-5 h-5" style={{ color: def.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: RARITY_COLOR[def.rarity] }}>
                    {def.name}
                  </div>
                  <div className="text-[10px] text-stone-500 mb-1">
                    {TIER_LABEL[def.tier]} · {RARITY_LABEL[def.rarity]}
                  </div>
                  <div className="flex gap-3 text-[10px] text-stone-400">
                    <span>DMG {def.damage}</span>
                    <span>{def.apCost === 1 ? 'VELOCE' : def.apCost === 2 ? 'MEDIA' : 'PESANTE'}</span>
                    <span>RNG {def.range.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-black border border-stone-900 rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      item.durability / item.maxDurability > 0.5
                        ? 'bg-emerald-600'
                        : item.durability / item.maxDurability > 0.2
                        ? 'bg-amber-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${(item.durability / item.maxDurability) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-stone-500">
                  {item.durability}/{item.maxDurability}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                {isEquipped ? (
                  <span className="px-2 py-1 text-[10px] bg-amber-900/40 text-amber-300 border border-amber-800 rounded font-bold tracking-wider">
                    EQUIPAGGIATA
                  </span>
                ) : (
                  <button
                    onClick={() => onEquip(item.uid)}
                    className="px-2 py-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded font-bold tracking-wider transition-colors"
                  >
                    EQUIPAGGIA
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Scartare questo oggetto?')) onDiscard(item.uid);
                  }}
                  className="px-2 py-1 text-[10px] bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-900 rounded transition-colors"
                >
                  Scarta
                </button>
              </div>
            </div>
          );
        }
        if (item.type === 'consumable') {
          const def = CONSUMABLES[item.defId];
          if (!def) return null;
          return (
            <div
              key={item.uid}
              className="border border-stone-800 bg-black/40 rounded p-3 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center border"
                style={{ backgroundColor: def.color + '30', borderColor: def.color }}
              >
                <Heart className="w-5 h-5" style={{ color: def.color }} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-stone-200">{def.name}</div>
                <div className="text-[10px] text-stone-500">{def.description}</div>
              </div>
              <div className="text-stone-300 font-bold">×{item.qty}</div>
            </div>
          );
        }
        if (item.type === 'valuable') {
          return (
            <div
              key={item.uid}
              className="border border-amber-900 bg-amber-950/20 rounded p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded bg-amber-900/30 border border-amber-700 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-amber-200">Oro</div>
                <div className="text-[10px] text-stone-500">Valore monetario</div>
              </div>
              <div className="text-amber-300 font-bold">{item.value}</div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ShopView({
  gold,
  onBuyWeapon,
  onBuyConsumable,
  shopConsumables,
}: {
  gold: number;
  onBuyWeapon: (tier: string) => void;
  onBuyConsumable: (id: string, cost: number) => void;
  shopConsumables: { id: string; cost: number }[];
}) {
  const weaponOffers: { tier: string; cost: number }[] = [
    { tier: 'neolithic', cost: 30 },
    { tier: 'bronze', cost: 80 },
    { tier: 'iron', cost: 180 },
    { tier: 'medieval', cost: 400 },
    { tier: 'renaissance', cost: 900 },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
          <Swords className="w-4 h-4" /> Armi Casuali
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {weaponOffers.map((o) => {
            const color = TIER_COLOR[o.tier as keyof typeof TIER_COLOR];
            const label = TIER_LABEL[o.tier as keyof typeof TIER_LABEL];
            const canAfford = gold >= o.cost;
            return (
              <button
                key={o.tier}
                onClick={() => onBuyWeapon(o.tier)}
                disabled={!canAfford}
                className="flex items-center gap-3 p-3 border rounded text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  borderColor: color,
                  background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full border-2"
                  style={{ borderColor: color, backgroundColor: color + '30' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-bold" style={{ color }}>
                    {label}
                  </div>
                  <div className="text-[10px] text-stone-500">Arma casuale del tier</div>
                </div>
                <div className={`text-sm font-bold ${canAfford ? 'text-amber-300' : 'text-red-500'}`}>
                  {o.cost} oro
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="text-amber-200 text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
          <Heart className="w-4 h-4" /> Curativi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {shopConsumables.map((sc) => {
            const def = CONSUMABLES[sc.id];
            if (!def) return null;
            const canAfford = gold >= sc.cost;
            return (
              <button
                key={sc.id}
                onClick={() => onBuyConsumable(sc.id, sc.cost)}
                disabled={!canAfford}
                className="p-3 border rounded text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: def.color, background: def.color + '10' }}
              >
                <div className="text-sm font-bold" style={{ color: def.color }}>
                  {def.name}
                </div>
                <div className="text-[10px] text-stone-500 mb-1">{def.description}</div>
                <div className={`text-sm font-bold ${canAfford ? 'text-amber-300' : 'text-red-500'}`}>
                  {sc.cost} oro
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
