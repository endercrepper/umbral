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
}

export type GamePhase = 'menu' | 'hub' | 'raid' | 'extracted' | 'dead';

export interface RunStats {
  kills: number;
  damageDealt: number;
  damageTaken: number;
  roomsCleared: number;
  lootValue: number;
  timeAlive: number;
}

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
