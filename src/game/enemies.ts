// === UMBRAL: Enemy Database ===
import type { EnemyDef, EnemyKind } from './types';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  wretch: {
    kind: 'wretch',
    name: 'Sventurato',
    maxHp: 40,
    damage: 8,
    speed: 2.2,
    attackRange: 1.4,
    attackCooldown: 1.2,
    detectRange: 6,
    color: '#5a4a3a',
    scale: 0.85,
    xpReward: 5,
    lootChance: 0.35,
    description: 'Una creatura deforme, un tempo umana. Debole ma numerosa.',
  },
  cultist: {
    kind: 'cultist',
    name: 'Cultista',
    maxHp: 65,
    damage: 14,
    speed: 1.9,
    attackRange: 1.6,
    attackCooldown: 1.5,
    detectRange: 7,
    color: '#6b2c4a',
    scale: 1.0,
    xpReward: 12,
    lootChance: 0.5,
    description: 'Servo di divinità dimenticate. Lancia maledizioni a distanza.',
  },
  knight: {
    kind: 'knight',
    name: 'Cavaliere Caduto',
    maxHp: 140,
    damage: 28,
    speed: 1.6,
    attackRange: 1.9,
    attackCooldown: 1.8,
    detectRange: 6,
    color: '#3a3a4a',
    scale: 1.15,
    xpReward: 30,
    lootChance: 0.75,
    description: 'Un tempo paladino, ora corrotto. Armatura pesante, lento ma letale.',
  },
  beast: {
    kind: 'beast',
    name: 'Bestia dell\'Ombra',
    maxHp: 95,
    damage: 22,
    speed: 3.0,
    attackRange: 1.5,
    attackCooldown: 1.0,
    detectRange: 9,
    color: '#2a1a3a',
    scale: 1.2,
    xpReward: 22,
    lootChance: 0.55,
    description: 'Predatore delle profondità. Veloce, feroce, implacabile.',
  },
  boss: {
    kind: 'boss',
    name: 'Signore delle Profondità',
    maxHp: 380,
    damage: 45,
    speed: 1.8,
    attackRange: 2.4,
    attackCooldown: 2.2,
    detectRange: 10,
    color: '#4a0e1a',
    scale: 1.6,
    xpReward: 100,
    lootChance: 1.0,
    description: 'Antico male che dimora nelle viscere. La sua morte echeggia per secoli.',
  },
};

export interface Consumable {
  id: string;
  name: string;
  healAmount: number;
  weight: number;
  color: string;
  description: string;
}

export const CONSUMABLES: Record<string, Consumable> = {
  herb: {
    id: 'herb',
    name: 'Erba Curativa',
    healAmount: 25,
    weight: 0.2,
    color: '#4a7c3a',
    description: 'Erbe selvatiche con proprietà curative. Ripristina 25 HP.',
  },
  potion: {
    id: 'potion',
    name: 'Pozione Minore',
    healAmount: 60,
    weight: 0.5,
    color: '#c8323a',
    description: 'Pozione rubea. Ripristina 60 HP.',
  },
  elixir: {
    id: 'elixir',
    name: 'Elisir Antico',
    healAmount: 150,
    weight: 0.8,
    color: '#e8c547',
    description: 'Elisir dell\'epoca perduta. Cura quasi completamente.',
  },
};

export function randomLootValue(): number {
  return Math.floor(Math.random() * 50) + 10;
}
