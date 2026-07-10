// === UMBRAL: Game State Store (Zustand) - Turn-based ===
'use client';

import { create } from 'zustand';
import type {
  GamePhase,
  WeaponInstance,
  RunStats,
  WeaponTier,
  PlayerStats,
  Perk,
} from './types';
import { WEAPON_MAP, randomWeapon } from './weapons';
import { CONSUMABLES } from './enemies';

export interface InventoryItem {
  uid: string;
  type: 'weapon' | 'consumable' | 'valuable';
  defId: string;
  qty?: number;
  value?: number;
  durability?: number;
  maxDurability?: number;
}

export interface GameState {
  phase: GamePhase;
  // Persistent stash (survives between raids, NOT through death)
  stash: InventoryItem[];
  // Equipped weapon for next raid
  equippedWeaponUid: string | null;
  // Carried consumables for next raid (reset on raid start)
  carriedConsumables: InventoryItem[];
  // During raid - carried loot (lost on death)
  raidLoot: InventoryItem[];
  // Player progression
  level: number;
  xp: number;
  totalRaids: number;
  successfulExtractions: number;
  deaths: number;
  bestRaidValue: number;
  // Currency (gold)
  gold: number;
  // Last run stats
  lastRunStats: RunStats | null;
  // Difficulty selection
  difficulty: number;
  // Hub message/log
  log: string[];
  // Player stats (Stoneshard-style)
  baseStats: PlayerStats;
  // Perks unlocked
  perks: string[];
  // Pending level-up (player must choose a perk)
  pendingLevelUps: number;

  // Actions
  setPhase: (phase: GamePhase) => void;
  addToStash: (item: InventoryItem) => void;
  removeFromStash: (uid: string) => void;
  equipWeapon: (uid: string) => void;
  addConsumable: (defId: string, qty?: number) => void;
  useConsumable: (uid: string) => void;
  startRaid: (difficulty: number) => void;
  // During raid actions
  addRaidLoot: (item: InventoryItem) => void;
  removeRaidLoot: (uid: string) => void;
  extractRaid: (stats: RunStats) => void;
  dieInRaid: (stats: RunStats) => void;
  setDifficulty: (d: number) => void;
  addGold: (g: number) => void;
  spendGold: (g: number) => boolean;
  buyStarterWeapon: (tier: WeaponTier) => boolean;
  logMessage: (msg: string) => void;
  applyPerk: (perkId: string) => void;
  reset: () => void;
}

let _uidCounter = 0;
function uid(): string {
  _uidCounter += 1;
  const randomPart = typeof window === 'undefined'
    ? '0'
    : Math.random().toString(36).slice(2, 9);
  return `id-${_uidCounter}-${randomPart}`;
}

function makeWeaponInstance(defId: string): InventoryItem {
  const def = WEAPON_MAP[defId];
  const maxDur = def ? Math.floor(40 + def.damage * 1.5) : 50;
  return {
    uid: uid(),
    type: 'weapon',
    defId,
    durability: maxDur,
    maxDurability: maxDur,
  };
}

// Use a deterministic UID for SSR consistency
const STARTER_WEAPON: InventoryItem = {
  uid: 'starter-flint-knife',
  type: 'weapon',
  defId: 'flint_knife',
  durability: 65,
  maxDurability: 65,
};

const BASE_STATS: PlayerStats = {
  might: 0,
  agility: 0,
  vitality: 0,
  focus: 0,
};

export const useGame = create<GameState>((set, get) => ({
  phase: 'menu',
  stash: [STARTER_WEAPON],
  equippedWeaponUid: STARTER_WEAPON.uid,
  carriedConsumables: [
    { uid: 'starter-herb', type: 'consumable', defId: 'herb', qty: 2 },
  ],
  raidLoot: [],
  level: 1,
  xp: 0,
  totalRaids: 0,
  successfulExtractions: 0,
  deaths: 0,
  bestRaidValue: 0,
  gold: 50,
  lastRunStats: null,
  difficulty: 1,
  log: ['Benvenuto in UMBRAL. Le profondità attendono.'],
  baseStats: { ...BASE_STATS },
  perks: [],
  pendingLevelUps: 0,

  setPhase: (phase) => set({ phase }),

  addToStash: (item) => set((s) => ({ stash: [...s.stash, item] })),

  removeFromStash: (u) =>
    set((s) => ({
      stash: s.stash.filter((i) => i.uid !== u),
      equippedWeaponUid:
        s.equippedWeaponUid === u ? null : s.equippedWeaponUid,
    })),

  equipWeapon: (uid) => set({ equippedWeaponUid: uid }),

  addConsumable: (defId, qty = 1) =>
    set((s) => {
      const existing = s.carriedConsumables.find((c) => c.defId === defId);
      if (existing) {
        return {
          carriedConsumables: s.carriedConsumables.map((c) =>
            c.defId === defId ? { ...c, qty: (c.qty || 0) + qty } : c,
          ),
        };
      }
      return {
        carriedConsumables: [
          ...s.carriedConsumables,
          { uid: uid(), type: 'consumable' as const, defId, qty },
        ],
      };
    }),

  useConsumable: (u) =>
    set((s) => ({
      carriedConsumables: s.carriedConsumables
        .map((c) =>
          c.uid === u ? { ...c, qty: Math.max(0, (c.qty || 0) - 1) } : c,
        )
        .filter((c) => (c.qty || 0) > 0),
    })),

  startRaid: (difficulty) =>
    set((s) => ({
      phase: 'raid',
      difficulty,
      raidLoot: [],
      totalRaids: s.totalRaids + 1,
      log: [...s.log, `Raid iniziato (difficoltà ${difficulty}).`].slice(-20),
    })),

  addRaidLoot: (item) => set((s) => ({ raidLoot: [...s.raidLoot, item] })),

  removeRaidLoot: (u) =>
    set((s) => ({ raidLoot: s.raidLoot.filter((i) => i.uid !== u) })),

  extractRaid: (stats) =>
    set((s) => {
      const newStash = [...s.stash, ...s.raidLoot];
      const totalValue = stats.lootValue;
      const xpGain = stats.kills * 8 + Math.floor(totalValue / 5) + Math.floor(stats.turnsPlayed / 2);
      const newXp = s.xp + xpGain;
      const newLevel = Math.floor(newXp / 100) + 1;
      const levelGained = newLevel - s.level;
      const goldGain = Math.floor(totalValue / 2);
      return {
        phase: 'extracted',
        stash: newStash,
        raidLoot: [],
        successfulExtractions: s.successfulExtractions + 1,
        bestRaidValue: Math.max(s.bestRaidValue, totalValue),
        xp: newXp,
        level: newLevel,
        gold: s.gold + goldGain,
        lastRunStats: stats,
        pendingLevelUps: s.pendingLevelUps + levelGained,
        log: [
          ...s.log,
          `Estrazione riuscita! +${xpGain} XP, +${goldGain} oro.`,
        ].slice(-20),
      };
    }),

  dieInRaid: (stats) =>
    set((s) => ({
      phase: 'dead',
      raidLoot: [],
      deaths: s.deaths + 1,
      // Equipped weapon is lost (was carried into raid)
      stash: s.stash.filter((i) => i.uid !== s.equippedWeaponUid),
      equippedWeaponUid: null,
      lastRunStats: stats,
      log: [
        ...s.log,
        `Sei morto. Tutto il bottino è perduto. ${stats.kills} uccisioni.`,
      ].slice(-20),
    })),

  setDifficulty: (d) => set({ difficulty: d }),

  addGold: (g) => set((s) => ({ gold: s.gold + g })),

  spendGold: (g) => {
    const s = get();
    if (s.gold < g) return false;
    set({ gold: s.gold - g });
    return true;
  },

  buyStarterWeapon: (tier) => {
    const s = get();
    const cost = { neolithic: 30, bronze: 80, iron: 180, medieval: 400, renaissance: 900 }[tier];
    if (s.gold < cost) return false;
    const def = randomWeapon(tier === 'neolithic' ? 0 : tier === 'bronze' ? 1 : 2);
    if (!def) return false;
    const inst = makeWeaponInstance(def.id);
    set({
      gold: s.gold - cost,
      stash: [...s.stash, inst],
      log: [...s.log, `Acquistato: ${def.name}.`].slice(-20),
    });
    return true;
  },

  logMessage: (msg) =>
    set((s) => ({ log: [...s.log, msg].slice(-30) })),

  applyPerk: (perkId) =>
    set((s) => {
      // Local import to avoid circular
      const ALL_PERKS = [
        { id: 'brute', name: 'Forza Bruta', stat: 'might', bonus: 15 },
        { id: 'swift', name: 'Piedi Veli', stat: 'agility', bonus: 1 },
        { id: 'steady', name: 'Polso Saldo', stat: 'agility', bonus: 10 },
        { id: 'tough', name: 'Tempra', stat: 'vitality', bonus: 25 },
        { id: 'resilient', name: 'Resiliente', stat: 'vitality', bonus: 50 },
        { id: 'sharp_eye', name: 'Occhio Acuto', stat: 'focus', bonus: 20 },
        { id: 'armorsmith', name: 'Armaiolo', stat: 'focus', bonus: 25 },
        { id: 'berserker', name: 'Berserker', stat: 'might', bonus: 25 },
      ] as const;
      const perk = ALL_PERKS.find((p) => p.id === perkId);
      if (!perk) return s;
      return {
        baseStats: {
          ...s.baseStats,
          [perk.stat]: s.baseStats[perk.stat] + perk.bonus,
        },
        perks: [...s.perks, perkId],
        pendingLevelUps: Math.max(0, s.pendingLevelUps - 1),
        log: [...s.log, `Perk sbloccato: ${perk.name}.`].slice(-30),
      };
    }),

  reset: () =>
    set({
      phase: 'menu',
      stash: [STARTER_WEAPON],
      equippedWeaponUid: STARTER_WEAPON.uid,
      carriedConsumables: [
        { uid: 'reset-herb', type: 'consumable', defId: 'herb', qty: 2 },
      ],
      raidLoot: [],
      level: 1,
      xp: 0,
      totalRaids: 0,
      successfulExtractions: 0,
      deaths: 0,
      bestRaidValue: 0,
      gold: 50,
      lastRunStats: null,
      difficulty: 1,
      baseStats: { ...BASE_STATS },
      perks: [],
      pendingLevelUps: 0,
      log: ['Nuova partita iniziata.'],
    }),
}));

export function makeItemUID(): string {
  return uid();
}

// Derived stats helper
export function getDerivedStats(stats: PlayerStats, level: number) {
  return {
    maxHp: 100 + stats.vitality,
    maxAp: 4 + Math.floor(stats.agility / 1), // each +1 agility from swift perk = +1 AP
    critChance: Math.min(60, stats.agility >= 10 ? (stats.agility - 10) * 2 : 0), // 10 agility from steady = first 10 don't count
    mightBonus: stats.might, // % bonus to melee damage
    focusBonus: stats.focus, // % bonus to ranged damage + durability
  };
}
