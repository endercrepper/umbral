// === UMBRAL: Hardcore Extraction - Type Definitions ===

export type Vec3 = [number, number, number];

export type WeaponTier = 'neolithic' | 'bronze' | 'iron' | 'medieval' | 'renaissance';

export type WeaponClass = 'axe' | 'sword' | 'spear' | 'mace' | 'dagger' | 'hammer' | 'polearm' | 'ranged';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface WeaponDef {
  id: string;
  name: string;
  tier: WeaponTier;
  class: WeaponClass;
  damage: number;
  attackSpeed: number; // attacks per second
  range: number;
  staminaCost: number;
  weight: number;
  rarity: Rarity;
  color: string; // hex visual color
  description: string;
  apCost: number; // turn-based: action points to attack
}

export interface WeaponInstance {
  uid: string;
  defId: string;
  currentDurability: number;
  maxDurability: number;
}

export interface ConsumableDef {
  id: string;
  name: string;
  healAmount: number;
  weight: number;
  color: string;
  description: string;
}

export type EnemyKind = 'wretch' | 'cultist' | 'knight' | 'beast' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  detectRange: number;
  color: string;
  scale: number;
  xpReward: number;
  lootChance: number;
  description: string;
  actionsPerTurn: number; // turn-based: how many actions per enemy turn
}

export type GamePhase = 'menu' | 'hub' | 'raid' | 'extracted' | 'dead';

export interface RunStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  roomsCleared: number;
  lootValue: number;
  timeAlive: number;
  turnsPlayed: number;
}

// Stoneshard-style secondary stats
export interface PlayerStats {
  might: number;     // +% melee damage
  agility: number;   // +AP, +crit chance
  vitality: number;  // +max HP
  focus: number;     // +range damage, +weapon durability
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  stat: keyof PlayerStats;
  bonus: number;
  icon: string;
}

export const PERKS: Perk[] = [
  { id: 'brute', name: 'Forza Bruta', description: '+15% danno mischia', stat: 'might', bonus: 15, icon: 'sword' },
  { id: 'swift', name: 'Riflessi Felini', description: '+15% prob. critico', stat: 'agility', bonus: 15, icon: 'wind' },
  { id: 'steady', name: 'Polso Saldo', description: '+10% prob. critico', stat: 'agility', bonus: 10, icon: 'target' },
  { id: 'tough', name: 'Tempra', description: '+25 HP massimi', stat: 'vitality', bonus: 25, icon: 'heart' },
  { id: 'resilient', name: 'Resiliente', description: '+50 HP massimi', stat: 'vitality', bonus: 50, icon: 'shield' },
  { id: 'sharp_eye', name: 'Occhio Acuto', description: '+20% danno a distanza', stat: 'focus', bonus: 20, icon: 'eye' },
  { id: 'armorsmith', name: 'Armaiolo', description: '+25% durabilità armi', stat: 'focus', bonus: 25, icon: 'hammer' },
  { id: 'berserker', name: 'Berserker', description: '+25% danno mischia', stat: 'might', bonus: 25, icon: 'flame' },
];

export interface DungeonCell {
  type: 'floor' | 'wall' | 'door' | 'loot' | 'extraction' | 'spawn';
  occupied: boolean;
}

export interface FloatingText {
  id: string;
  text: string;
  position: Vec3;
  color: string;
  ttl: number;
  born: number;
}

export interface ParticleBurst {
  id: string;
  position: Vec3;
  color: string;
  count: number;
  ttl: number;
  born: number;
}
