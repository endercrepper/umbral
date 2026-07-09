// === UMBRAL: Weapon Database - 5 Tiers from Neolithic to Renaissance ===
import type { WeaponDef, WeaponTier, Rarity } from './types';

export const TIER_ORDER: WeaponTier[] = ['neolithic', 'bronze', 'iron', 'medieval', 'renaissance'];

export const TIER_LABEL: Record<WeaponTier, string> = {
  neolithic: 'Neolitico',
  bronze: 'Età del Bronzo',
  iron: 'Età del Ferro',
  medieval: 'Medievale',
  renaissance: 'Rinascimentale',
};

export const TIER_COLOR: Record<WeaponTier, string> = {
  neolithic: '#8b7355',
  bronze: '#c98a3c',
  iron: '#9aa4b2',
  medieval: '#cfd8e3',
  renaissance: '#e8c547',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Comune',
  uncommon: 'Non Comune',
  rare: 'Raro',
  epic: 'Epico',
  legendary: 'Leggendario',
};

export const WEAPONS: WeaponDef[] = [
  // === NEOLITICO ===
  {
    id: 'flint_knife',
    name: 'Coltello di Selce',
    tier: 'neolithic',
    class: 'dagger',
    damage: 12,
    attackSpeed: 1.8,
    range: 1.4,
    staminaCost: 8,
    weight: 1,
    rarity: 'common',
    color: '#7d6b54',
    description: 'Una lama grezza di selce scheggiata. Leggera ma fragile.',
  },
  {
    id: 'stone_axe',
    name: 'Ascia di Pietra',
    tier: 'neolithic',
    class: 'axe',
    damage: 22,
    attackSpeed: 0.9,
    range: 1.7,
    staminaCost: 18,
    weight: 3,
    rarity: 'common',
    color: '#8b7355',
    description: 'Testa in pietra legata a un manico di legno. Lenta ma potente.',
  },
  {
    id: 'bone_spear',
    name: 'Lancia d\'Osso',
    tier: 'neolithic',
    class: 'spear',
    damage: 18,
    attackSpeed: 1.1,
    range: 2.4,
    staminaCost: 14,
    weight: 2,
    rarity: 'uncommon',
    color: '#e8d8b7',
    description: 'Punta d\'osso affilata su asta di legno. Portata superiore.',
  },

  // === ETÀ DEL BRONZO ===
  {
    id: 'bronze_shortsword',
    name: 'Spada Corta di Bronzo',
    tier: 'bronze',
    class: 'sword',
    damage: 28,
    attackSpeed: 1.4,
    range: 1.8,
    staminaCost: 12,
    weight: 2.5,
    rarity: 'uncommon',
    color: '#c98a3c',
    description: 'Lama di bronzo forgiato. Equilibrio tra velocità e potenza.',
  },
  {
    id: 'bronze_mace',
    name: 'Mazza di Bronzo',
    tier: 'bronze',
    class: 'mace',
    damage: 38,
    attackSpeed: 0.8,
    range: 1.6,
    staminaCost: 22,
    weight: 4,
    rarity: 'uncommon',
    color: '#b87a30',
    description: 'Testa di bronzo massiccio. Schiaccia armature e ossa.',
  },
  {
    id: 'bronze_spear',
    name: 'Lancia di Bronzo',
    tier: 'bronze',
    class: 'spear',
    damage: 32,
    attackSpeed: 1.0,
    range: 2.6,
    staminaCost: 16,
    weight: 3,
    rarity: 'rare',
    color: '#d99a4c',
    description: 'Punta di bronzo su asta di frassino. Versione migliorata della lancia neolitica.',
  },

  // === ETÀ DEL FERRO ===
  {
    id: 'iron_longsword',
    name: 'Spada Lunga di Ferro',
    tier: 'iron',
    class: 'sword',
    damage: 48,
    attackSpeed: 1.3,
    range: 2.0,
    staminaCost: 14,
    weight: 3.5,
    rarity: 'rare',
    color: '#9aa4b2',
    description: 'Lama di ferro temprato. L\'arma versatile del guerriero.',
  },
  {
    id: 'war_hammer',
    name: 'Martello da Guerra',
    tier: 'iron',
    class: 'hammer',
    damage: 65,
    attackSpeed: 0.6,
    range: 1.7,
    staminaCost: 28,
    weight: 6,
    rarity: 'rare',
    color: '#7a8290',
    description: 'Testa di ferro pesante. Polverizza difese nemiche.',
  },
  {
    id: 'iron_halberd',
    name: 'Alabarda di Ferro',
    tier: 'iron',
    class: 'polearm',
    damage: 55,
    attackSpeed: 0.9,
    range: 2.8,
    staminaCost: 20,
    weight: 5,
    rarity: 'epic',
    color: '#aab4c2',
    description: 'Lama e punta su lunga asta. Letale a distanza.',
  },

  // === MEDIEVALE ===
  {
    id: 'knight_sword',
    name: 'Spada del Cavaliere',
    tier: 'medieval',
    class: 'sword',
    damage: 72,
    attackSpeed: 1.2,
    range: 2.1,
    staminaCost: 16,
    weight: 4,
    rarity: 'epic',
    color: '#cfd8e3',
    description: 'Acciaio damasco forgia nobile. Sangue di molti uomini.',
  },
  {
    id: 'heavy_battleaxe',
    name: 'Ascia da Battaglia Pesante',
    tier: 'medieval',
    class: 'axe',
    damage: 95,
    attackSpeed: 0.7,
    range: 1.9,
    staminaCost: 30,
    weight: 7,
    rarity: 'epic',
    color: '#b8c0cc',
    description: 'Ascia bipenne da guerra. Colpi devastanti, lenti.',
  },
  {
    id: 'crossbow',
    name: 'Balestra',
    tier: 'medieval',
    class: 'ranged',
    damage: 85,
    attackSpeed: 0.5,
    range: 8.0,
    staminaCost: 25,
    weight: 5,
    rarity: 'legendary',
    color: '#6b4423',
    description: 'Balestra di acciaio. Colpisce a distanza con forza bruta.',
  },

  // === RINASCIMENTALE ===
  {
    id: 'masterwork_rapier',
    name: 'Stocco da Maestro',
    tier: 'renaissance',
    class: 'sword',
    damage: 88,
    attackSpeed: 2.0,
    range: 2.3,
    staminaCost: 10,
    weight: 2,
    rarity: 'legendary',
    color: '#e8c547',
    description: 'Lama sottile forgiata da maestro italiano. Velocità folle.',
  },
  {
    id: 'zweihander',
    name: 'Zweihänder Imperiale',
    tier: 'renaissance',
    class: 'sword',
    damage: 130,
    attackSpeed: 0.7,
    range: 2.6,
    staminaCost: 32,
    weight: 8,
    rarity: 'legendary',
    color: '#f0d050',
    description: 'Spada a due mani gigantesca. Polverizza qualsiasi difesa.',
  },
  {
    id: 'flintlock_pistol',
    name: 'Pistola a Pietra',
    tier: 'renaissance',
    class: 'ranged',
    damage: 110,
    attackSpeed: 0.8,
    range: 10.0,
    staminaCost: 18,
    weight: 3,
    rarity: 'legendary',
    color: '#3a2a1a',
    description: 'Arma da fuoco sperimentale. Rumorosa ma letale.',
  },
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);

export function getWeapon(defId: string): WeaponDef | undefined {
  return WEAPON_MAP[defId];
}

export function randomWeaponByTier(tier: WeaponTier, rarity?: Rarity): WeaponDef {
  const pool = WEAPONS.filter((w) => w.tier === tier && (!rarity || w.rarity === rarity));
  if (pool.length === 0) {
    const tierPool = WEAPONS.filter((w) => w.tier === tier);
    if (tierPool.length === 0) return WEAPONS[0];
    return tierPool[Math.floor(Math.random() * tierPool.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomWeapon(rarityBias: number = 0): WeaponDef {
  // Higher rarityBias → higher chance of high tier
  const tierRoll = Math.random() * 100 + rarityBias * 20;
  let tier: WeaponTier;
  if (tierRoll < 30) tier = 'neolithic';
  else if (tierRoll < 55) tier = 'bronze';
  else if (tierRoll < 78) tier = 'iron';
  else if (tierRoll < 93) tier = 'medieval';
  else tier = 'renaissance';
  return randomWeaponByTier(tier);
}
