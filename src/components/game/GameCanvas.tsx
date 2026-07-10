// === UMBRAL: WebGL Game Engine (Three.js) - TURN-BASED ===
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useGame, makeItemUID, getDerivedStats } from '@/game/store';
import { generateDungeon, type DungeonData } from '@/game/dungeon';
import { WEAPON_MAP, randomWeapon } from '@/game/weapons';
import { ENEMIES, CONSUMABLES } from '@/game/enemies';
import type { RunStats, Vec3, WeaponDef } from '@/game/types';
import type { InventoryItem } from '@/game/store';

interface Enemy {
  mesh: THREE.Group;
  hpBar: THREE.Sprite;
  hp: number;
  maxHp: number;
  kind: string;
  alive: boolean;
  hitFlash: number;
  tileX: number;
  tileY: number;
  actionsLeft: number;
}

interface LootItem {
  mesh: THREE.Object3D;
  item: InventoryItem;
  bobOffset: number;
  tileX: number;
  tileY: number;
}

interface FloatingText {
  sprite: THREE.Sprite;
  born: number;
  ttl: number;
  vy: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  born: number;
  ttl: number;
}

interface ActionLogEntry {
  id: number;
  text: string;
  color: string;
  turn: number;
}

const TILE = 2; // world units per dungeon tile
const PLAYER_MAX_HP_BASE = 100;
// Stoneshard-style: 1 action per turn
const EXTRACTION_TURNS_REQUIRED = 3;
const MOVE_TWEEN_DURATION = 0.14;
const ATTACK_ANIM_DURATION = 0.24;
const ENEMY_ACTION_DELAY = 0.10; // delay between enemy actions
const ENEMY_IDLE_DELAY = 0.02;   // delay when enemy has no valid action (just skip)
const ENEMY_RELEVANT_RANGE = 14; // tiles — skip enemies beyond this from player

type Turn = 'player' | 'enemy';

export default function GameCanvas({ onStats }: { onStats: (s: any) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<UmbralEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let engine: UmbralEngine | null = null;
    try {
      engine = new UmbralEngine(mountRef.current, onStats);
      engineRef.current = engine;
      engine.start();
    } catch (e: any) {
      console.error(e);
      setTimeout(() => setError(e.message || String(e)), 0);
    }
    return () => {
      if (engine) engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Imperative API for HUD
  useEffect(() => {
    const consumeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      engineRef.current?.consumeItem(detail.uid);
    };
    const endTurnHandler = () => {
      engineRef.current?.endTurn();
    };
    window.addEventListener('umbral-consume', consumeHandler);
    window.addEventListener('umbral-end-turn', endTurnHandler);
    return () => {
      window.removeEventListener('umbral-consume', consumeHandler);
      window.removeEventListener('umbral-end-turn', endTurnHandler);
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-400">
        <div className="text-center p-8">
          <div className="text-xl mb-2">Errore di rendering WebGL</div>
          <div className="text-sm text-red-300">{error}</div>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full" />;
}

class UmbralEngine {
  private mount: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  // Dungeon
  private dungeon!: DungeonData;

  // Player
  private player!: THREE.Group;
  private playerWeapon!: THREE.Mesh;
  private playerHp = PLAYER_MAX_HP_BASE;
  private playerMaxHp = PLAYER_MAX_HP_BASE;
  private playerHasAction = true; // single action per turn — Stoneshard style
  private playerTileX = 0;
  private playerTileY = 0;
  private playerTargetX = 0;
  private playerTargetZ = 0;
  private playerFacing = 0;
  private playerRadius = 0.4;
  private playerInvuln = false;
  private playerCritChance = 0;
  private playerMightBonus = 0;
  private playerFocusBonus = 0;

  // Tween state
  private isAnimating = false;
  private animTimer = 0;
  private animDuration = 0;
  private animFrom = new THREE.Vector3();
  private animTo = new THREE.Vector3();
  private animMode: 'move' | 'attack' | 'none' = 'none';
  private attackSwingT = 0;

  // Turn state
  private currentTurn: Turn = 'player';
  private turnCount = 1;
  private enemyQueue: Enemy[] = [];
  private enemyActionTimer = 0;
  private enemyActionInProgress = false;
  private extractionTurnsAccumulated = 0;

  // Input
  private keys: Record<string, boolean> = {};
  private keysJustPressed: Record<string, boolean> = {};
  private mouseWorld = new THREE.Vector3();
  private mouseDown = false;
  private mouseClicked = false;
  private keyRepeatTimer: Record<string, number> = {};

  // Entities
  private enemies: Enemy[] = [];
  private lootItems: LootItem[] = [];
  private floatingTexts: FloatingText[] = [];
  private particles: Particle[] = [];
  private walls: THREE.Mesh[] = [];
  private occupiedTiles: Set<string> = new Set();
  private extractionMesh!: THREE.Mesh;
  private extractionLight!: THREE.PointLight;
  private torch!: THREE.PointLight;
  private torches: { light: THREE.PointLight; flame: THREE.Mesh; baseSeed: number }[] = [];
  private turnIndicator!: THREE.Mesh; // ring around player
  private hoverIndicator!: THREE.Mesh;

  // Equipment
  private weaponDef!: WeaponDef;
  private weaponDurability = 50;
  private weaponMaxDurability = 50;
  private carriedConsumables: { uid: string; defId: string; qty: number }[] = [];

  // Stats
  private kills = 0;
  private damageDealt = 0;
  private damageTaken = 0;
  private raidStart = 0;
  private carriedLootValue = 0;
  private actionLog: ActionLogEntry[] = [];
  private logCounter = 0;

  // Callback
  private onStats: (s: any) => void;
  private statsTimer = 0;

  // Materials
  private matFloor!: THREE.MeshStandardMaterial;
  private matWall!: THREE.MeshStandardMaterial;
  private matPlayer!: THREE.MeshStandardMaterial;

  constructor(mount: HTMLDivElement, onStats: (s: any) => void) {
    this.mount = mount;
    this.onStats = onStats;
  }

  start() {
    this.initRenderer();
    this.initScene();
    this.loadEquipment();
    this.initDungeon();
    this.initPlayer();
    this.initInput();
    this.raidStart = performance.now();
    this.logAction('Discesa iniziata. Turno 1.', '#fbbf24');
    this.clock.start();
    this.animate();
  }

  private initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.mount.appendChild(this.renderer.domElement);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.04);

    this.camera = new THREE.PerspectiveCamera(
      50,
      this.mount.clientWidth / this.mount.clientHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 13, 7);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0x2a2a3a, 0.85);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x3a3050, 0x20140a, 0.55);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0x5a5278, 0.5);
    dir.position.set(20, 30, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -30;
    dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -30;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 80;
    this.scene.add(dir);

    this.matFloor = new THREE.MeshStandardMaterial({
      color: 0x1a1620,
      roughness: 0.95,
      metalness: 0.05,
    });
    this.matWall = new THREE.MeshStandardMaterial({
      color: 0x2a2230,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.matPlayer = new THREE.MeshStandardMaterial({
      color: 0xb0a890,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x110a05,
    });
  }

  private loadEquipment() {
    const gs = useGame.getState();
    const equipped = gs.stash.find((w) => w.uid === gs.equippedWeaponUid);
    if (equipped && equipped.defId) {
      this.weaponDef = WEAPON_MAP[equipped.defId];
      this.weaponDurability = equipped.durability || 50;
      this.weaponMaxDurability = equipped.maxDurability || 50;
    } else {
      this.weaponDef = WEAPON_MAP['flint_knife'];
      this.weaponDurability = 50;
      this.weaponMaxDurability = 50;
    }
    this.carriedConsumables = gs.carriedConsumables.map((c) => ({
      uid: c.uid,
      defId: c.defId,
      qty: c.qty || 0,
    }));

    // Derived stats from perks
    const derived = getDerivedStats(gs.baseStats, gs.level);
    this.playerMaxHp = derived.maxHp;
    this.playerHp = derived.maxHp;
    this.playerHasAction = true;
    this.playerCritChance = derived.critChance;
    this.playerMightBonus = derived.mightBonus;
    this.playerFocusBonus = derived.focusBonus;
  }

  private initDungeon() {
    const seed = Math.floor(Math.random() * 1000000);
    const diff = useGame.getState().difficulty;
    this.dungeon = generateDungeon(seed, diff);

    const tileGeom = new THREE.PlaneGeometry(TILE, TILE);
    tileGeom.rotateX(-Math.PI / 2);
    const wallGeom = new THREE.BoxGeometry(TILE, TILE * 1.6, TILE);

    const floorGroup = new THREE.Group();
    const wallGroup = new THREE.Group();
    this.scene.add(floorGroup);
    this.scene.add(wallGroup);

    for (let y = 0; y < this.dungeon.height; y++) {
      for (let x = 0; x < this.dungeon.width; x++) {
        const cell = this.dungeon.cells[y][x];
        if (cell === 'wall') continue;
        const floor = new THREE.Mesh(tileGeom, this.matFloor);
        floor.position.set(x * TILE, 0, y * TILE);
        floor.receiveShadow = true;
        floorGroup.add(floor);

        for (const [dx, dy] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.dungeon.width || ny >= this.dungeon.height) continue;
          if (this.dungeon.cells[ny][nx] === 'wall') {
            const wmesh = new THREE.Mesh(wallGeom, this.matWall);
            wmesh.position.set(nx * TILE, TILE * 0.8, ny * TILE);
            wmesh.castShadow = true;
            wmesh.receiveShadow = true;
            wallGroup.add(wmesh);
            this.walls.push(wmesh);
          }
        }
      }
    }

    // Loot
    for (const spot of this.dungeon.lootSpots) {
      this.spawnLoot(spot.x, spot.y);
    }

    // Extraction portal
    const ext = this.dungeon.extraction;
    const extGeom = new THREE.CircleGeometry(TILE * 0.7, 24);
    extGeom.rotateX(-Math.PI / 2);
    const extMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.7,
    });
    this.extractionMesh = new THREE.Mesh(extGeom, extMat);
    this.extractionMesh.position.set(ext.x * TILE, 0.05, ext.y * TILE);
    this.scene.add(this.extractionMesh);

    this.extractionLight = new THREE.PointLight(0x00ff88, 4, 14);
    this.extractionLight.position.set(ext.x * TILE, 1.8, ext.y * TILE);
    this.scene.add(this.extractionLight);

    // Spawn enemies
    for (const es of this.dungeon.enemySpawns) {
      this.spawnEnemy(es.x, es.y, es.kind);
    }

    // Player spawn
    this.playerTileX = this.dungeon.spawn.x;
    this.playerTileY = this.dungeon.spawn.y;
    this.playerTargetX = this.playerTileX * TILE;
    this.playerTargetZ = this.playerTileY * TILE;

    // Place wall torches throughout the dungeon for visibility
    this.placeTorches();
  }

  private placeTorches() {
    // Strategy: for each room, place 1-2 torches on adjacent wall tiles.
    // Also scatter some along long corridors.
    const placed = new Set<string>();
    const tryPlace = (floorX: number, floorY: number) => {
      // Find a wall tile adjacent to this floor tile
      const candidates: { x: number; y: number; dir: number }[] = [];
      const dirs = [
        { dx: 1, dy: 0, ang: -Math.PI / 2 },
        { dx: -1, dy: 0, ang: Math.PI / 2 },
        { dx: 0, dy: 1, ang: 0 },
        { dx: 0, dy: -1, ang: Math.PI },
      ];
      for (const d of dirs) {
        const wx = floorX + d.dx;
        const wy = floorY + d.dy;
        if (wx < 0 || wy < 0 || wx >= this.dungeon.width || wy >= this.dungeon.height) continue;
        if (this.dungeon.cells[wy][wx] === 'wall') {
          candidates.push({ x: wx, y: wy, ang: d.ang });
        }
      }
      if (candidates.length === 0) return false;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const key = `${pick.x},${pick.y}`;
      if (placed.has(key)) return false;
      placed.add(key);
      this.spawnTorch(pick.x, pick.y, pick.ang);
      return true;
    };

    // Torches in rooms (corners and center-adjacent)
    for (const room of this.dungeon.rooms) {
      // 2 torches per room: top-left and bottom-right corners (inset)
      tryPlace(room.x + 1, room.y + 1);
      tryPlace(room.x + room.w - 2, room.y + room.h - 2);
      // Big rooms get extra
      if (room.w >= 7 || room.h >= 7) {
        tryPlace(room.x + 1, room.y + room.h - 2);
        tryPlace(room.x + room.w - 2, room.y + 1);
      }
    }

    // Torches along corridors: scan all floor tiles, place every ~6 tiles
    // on tiles that have a wall neighbor (so torch can attach)
    let corridorCount = 0;
    for (let y = 0; y < this.dungeon.height; y++) {
      for (let x = 0; x < this.dungeon.width; x++) {
        if (this.dungeon.cells[y][x] !== 'floor') continue;
        // Skip tiles inside rooms
        let inRoom = false;
        for (const room of this.dungeon.rooms) {
          if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
            inRoom = true;
            break;
          }
        }
        if (inRoom) continue;
        corridorCount++;
        if (corridorCount % 6 === 0) {
          tryPlace(x, y);
        }
      }
    }
  }

  private spawnTorch(tileX: number, tileY: number, facingAngle: number) {
    // facingAngle: 0 = facing +Z (south), π = facing -Z (north), -π/2 = +X (east), π/2 = -X (west)
    // Compute the direction from the wall (tileX,tileY) toward the floor it should illuminate
    const dirX = Math.sin(facingAngle);
    const dirZ = Math.cos(facingAngle);

    // Position the torch slightly inside the wall tile, but the flame extends toward the floor
    const baseX = tileX * TILE + dirX * 0.3;
    const baseZ = tileY * TILE + dirZ * 0.3;
    // Flame position: further toward the floor
    const flameOffset = 0.6;
    const flameX = tileX * TILE + dirX * flameOffset;
    const flameZ = tileY * TILE + dirZ * flameOffset;

    const group = new THREE.Group();
    group.position.set(baseX, 0, baseZ);

    // Wooden pole
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6),
      poleMat,
    );
    pole.position.y = 0.8;
    pole.castShadow = true;
    group.add(pole);

    // Bracket (small box at top of pole, extends toward floor)
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.18),
      poleMat,
    );
    bracket.position.set(dirX * 0.15, 1.55, dirZ * 0.15);
    bracket.rotation.y = facingAngle;
    group.add(bracket);

    // Flame (emissive sphere) - placed at flameX/flameZ position
    // depthTest false so flames are always visible (like billboards)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 10, 8),
      flameMat,
    );
    flame.position.set(flameX - baseX, 1.85, flameZ - baseZ);
    flame.scale.y = 1.8;
    flame.renderOrder = 999;
    group.add(flame);

    // Inner brighter flame core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      coreMat,
    );
    core.position.set(flameX - baseX, 1.85, flameZ - baseZ);
    core.scale.y = 1.5;
    core.renderOrder = 1000;
    group.add(core);

    this.scene.add(group);

    // Warm point light at flame position
    const light = new THREE.PointLight(0xffaa55, 2.2, 11, 1.5);
    light.position.set(flameX, 1.9, flameZ);
    this.scene.add(light);

    this.torches.push({
      light,
      flame,
      baseSeed: Math.random() * Math.PI * 2,
    });
  }

  private initPlayer() {
    this.player = new THREE.Group();

    const bodyGeom = new THREE.CylinderGeometry(0.35, 0.4, 1.4, 12);
    const body = new THREE.Mesh(bodyGeom, this.matPlayer);
    body.position.y = 0.7;
    body.castShadow = true;
    this.player.add(body);

    const headGeom = new THREE.SphereGeometry(0.28, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xd4c4a8,
      roughness: 0.7,
    });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    this.player.add(head);

    const capeGeom = new THREE.ConeGeometry(0.55, 1.2, 8, 1, true);
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x3a1a2a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const cape = new THREE.Mesh(capeGeom, capeMat);
    cape.position.set(0, 0.8, 0.2);
    cape.rotation.x = Math.PI;
    cape.castShadow = true;
    this.player.add(cape);

    const wpnColor = new THREE.Color(this.weaponDef.color);
    const wpnMat = new THREE.MeshStandardMaterial({
      color: wpnColor,
      roughness: 0.4,
      metalness: 0.6,
      emissive: wpnColor,
      emissiveIntensity: 0.15,
    });
    this.playerWeapon = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 1.1, 0.14),
      wpnMat,
    );
    this.playerWeapon.position.set(0.4, 0.8, 0.3);
    this.playerWeapon.castShadow = true;
    this.player.add(this.playerWeapon);

    this.torch = new THREE.PointLight(0xff8844, 2.5, 14, 1.8);
    this.torch.position.set(0, 2, 0);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(512, 512);
    this.player.add(this.torch);

    this.player.position.set(this.playerTargetX, 0, this.playerTargetZ);
    this.scene.add(this.player);

    // Turn indicator ring
    const ringGeom = new THREE.RingGeometry(0.55, 0.7, 32);
    ringGeom.rotateX(-Math.PI / 2);
    this.turnIndicator = new THREE.Mesh(
      ringGeom,
      new THREE.MeshBasicMaterial({
        color: 0x33ff55,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    this.turnIndicator.position.set(this.playerTargetX, 0.06, this.playerTargetZ);
    this.scene.add(this.turnIndicator);

    // Mouse hover indicator
    const hoverGeom = new THREE.RingGeometry(0.7, 0.85, 16);
    hoverGeom.rotateX(-Math.PI / 2);
    this.hoverIndicator = new THREE.Mesh(
      hoverGeom,
      new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    this.hoverIndicator.position.set(0, 0.06, 0);
    this.hoverIndicator.visible = false;
    this.scene.add(this.hoverIndicator);
  }

  private spawnEnemy(tileX: number, tileY: number, kind: string) {
    const def = ENEMIES[kind as keyof typeof ENEMIES];
    if (!def) return;
    const group = new THREE.Group();
    const color = new THREE.Color(def.color);

    let bodyMesh: THREE.Mesh;
    if (kind === 'boss') {
      const g = new THREE.IcosahedronGeometry(0.9 * def.scale, 1);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0.3,
          emissive: color,
          emissiveIntensity: 0.25,
        }),
      );
      bodyMesh.position.y = 1.2 * def.scale;
    } else if (kind === 'beast') {
      const g = new THREE.SphereGeometry(0.5 * def.scale, 10, 8);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 }),
      );
      bodyMesh.position.y = 0.5 * def.scale;
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x1a0a1a, roughness: 0.6 }),
        );
        const ang = (i / 4) * Math.PI * 2;
        spike.position.set(
          Math.cos(ang) * 0.4 * def.scale,
          0.9 * def.scale,
          Math.sin(ang) * 0.4 * def.scale,
        );
        group.add(spike);
      }
    } else if (kind === 'knight') {
      const g = new THREE.CylinderGeometry(0.4 * def.scale, 0.45 * def.scale, 1.5 * def.scale, 8);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 }),
      );
      bodyMesh.position.y = 0.85 * def.scale;
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 * def.scale, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.8, roughness: 0.2 }),
      );
      helm.position.y = 1.65 * def.scale;
      group.add(helm);
    } else if (kind === 'cultist') {
      const g = new THREE.CylinderGeometry(0.35 * def.scale, 0.55 * def.scale, 1.6 * def.scale, 8);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 }),
      );
      bodyMesh.position.y = 0.8 * def.scale;
      const hood = new THREE.Mesh(
        new THREE.ConeGeometry(0.4 * def.scale, 0.6 * def.scale, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a0a1a, roughness: 0.9 }),
      );
      hood.position.y = 1.65 * def.scale;
      group.add(hood);
    } else {
      const g = new THREE.SphereGeometry(0.45 * def.scale, 8, 6);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
      bodyMesh.position.y = 0.55 * def.scale;
      bodyMesh.scale.y = 1.3;
    }
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    group.position.set(tileX * TILE, 0, tileY * TILE);
    this.scene.add(group);

    const hpBar = this.makeHpBarSprite();
    hpBar.position.set(0, 2.2 * def.scale, 0);
    group.add(hpBar);

    this.occupiedTiles.add(`${tileX},${tileY}`);

    this.enemies.push({
      mesh: group,
      hpBar,
      hp: def.maxHp,
      maxHp: def.maxHp,
      kind,
      alive: true,
      hitFlash: 0,
      tileX,
      tileY,
      actionsLeft: def.actionsPerTurn,
    });
  }

  private makeHpBarSprite(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#220000';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(1, 1, 62, 6);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.2, 0.15, 1);
    sprite.visible = false;
    return sprite;
  }

  private updateHpBar(enemy: Enemy) {
    const canvas = (enemy.hpBar.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = '#220000';
    ctx.fillRect(0, 0, 64, 8);
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#33ff55' : ratio > 0.25 ? '#ffaa33' : '#ff3333';
    ctx.fillRect(1, 1, 62 * ratio, 6);
    (enemy.hpBar.material.map as THREE.CanvasTexture).needsUpdate = true;
  }

  private spawnLoot(tileX: number, tileY: number, item?: InventoryItem) {
    let lootItem: InventoryItem;
    if (!item) {
      const r = Math.random();
      if (r < 0.55) {
        const def = randomWeapon(useGame.getState().difficulty * 0.5);
        const maxDur = Math.floor(40 + def.damage * 1.5);
        lootItem = {
          uid: makeItemUID(),
          type: 'weapon',
          defId: def.id,
          durability: maxDur,
          maxDurability: maxDur,
        };
      } else if (r < 0.85) {
        const cKey = Math.random() < 0.6 ? 'herb' : Math.random() < 0.7 ? 'potion' : 'elixir';
        lootItem = {
          uid: makeItemUID(),
          type: 'consumable',
          defId: cKey,
          qty: Math.floor(Math.random() * 2) + 1,
        };
      } else {
        const v = Math.floor(Math.random() * 30) + 10;
        lootItem = {
          uid: makeItemUID(),
          type: 'valuable',
          defId: 'gold',
          value: v,
        };
      }
    } else {
      lootItem = item;
    }

    const group = new THREE.Group();
    let color = '#cccccc';
    if (lootItem.type === 'weapon') {
      const w = WEAPON_MAP[lootItem.defId];
      color = w?.color || '#cccccc';
    } else if (lootItem.type === 'consumable') {
      const c = CONSUMABLES[lootItem.defId];
      color = c?.color || '#cccccc';
    } else {
      color = '#e8c547';
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.6,
      metalness: 0.5,
      roughness: 0.4,
    });

    let mesh: THREE.Mesh;
    if (lootItem.type === 'weapon') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), mat);
    } else if (lootItem.type === 'valuable') {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat);
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat);
    }
    mesh.castShadow = true;
    group.add(mesh);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 16),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.3;
    group.add(halo);

    group.position.set(tileX * TILE, 0.5, tileY * TILE);
    this.scene.add(group);

    this.lootItems.push({
      mesh: group,
      item: lootItem,
      bobOffset: Math.random() * Math.PI * 2,
      tileX,
      tileY,
    });
  }

  private initInput() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.keys[e.code]) return;
      this.keys[e.code] = true;
      this.keysJustPressed[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(plane, hit);
      if (hit) this.mouseWorld.copy(hit);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false;
    };
    const onResize = () => {
      if (!this.mount) return;
      const w = this.mount.clientWidth;
      const h = this.mount.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    (this as any)._cleanupInput = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      this.renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
    };
  }

  consumeItem(uid: string) {
    if (this.currentTurn !== 'player') return;
    if (this.isAnimating) return;
    if (!this.playerHasAction) return;
    const idx = this.carriedConsumables.findIndex((c) => c.uid === uid);
    if (idx < 0) return;
    const c = this.carriedConsumables[idx];
    const def = CONSUMABLES[c.defId];
    if (!def) return;
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + def.healAmount);
    this.spawnFloatingText(`+${def.healAmount} HP`, this.player.position.toArray() as Vec3, '#33ff55');
    this.spawnParticles(this.player.position.toArray() as Vec3, '#33ff55', 16);
    c.qty -= 1;
    if (c.qty <= 0) this.carriedConsumables.splice(idx, 1);
    this.playerHasAction = false;
    this.logAction(`Usato ${def.name} (+${def.healAmount} HP)`, '#33ff55');
    this.afterPlayerAction();
  }

  endTurn() {
    if (this.currentTurn !== 'player') return;
    if (this.isAnimating) return;
    this.playerHasAction = false;
    this.logAction(`Turno passato`, '#888888');
    this.startEnemyTurn();
  }

  private logAction(text: string, color: string = '#cccccc') {
    this.actionLog.unshift({
      id: this.logCounter++,
      text,
      color,
      turn: this.turnCount,
    });
    if (this.actionLog.length > 12) this.actionLog.pop();
  }

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    // Update visual fx always
    this.updateFloatingTexts(dt);
    this.updateParticles(dt);
    this.updateLootBob(dt);
    this.updateCamera(dt);
    this.updateTorch();
    this.updateTorches();
    this.updateHoverIndicator();

    // Hit flashes
    for (const enemy of this.enemies) {
      if (enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        const body = enemy.mesh.children[0] as THREE.Mesh;
        if (body && (body.material as THREE.MeshStandardMaterial)) {
          (body.material as THREE.MeshStandardMaterial).emissive.setRGB(1, 0.3, 0.3);
          (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
        }
      } else if (enemy.alive) {
        const def = ENEMIES[enemy.kind as keyof typeof ENEMIES];
        const body = enemy.mesh.children[0] as THREE.Mesh;
        if (body && (body.material as THREE.MeshStandardMaterial)) {
          const baseColor = new THREE.Color(def.color);
          (body.material as THREE.MeshStandardMaterial).emissive.copy(baseColor);
          (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        }
      }
    }

    // Animation tween
    if (this.isAnimating) {
      this.animTimer += dt;
      const t = Math.min(1, this.animTimer / this.animDuration);
      const e = easeOutCubic(t);
      if (this.animMode === 'move') {
        this.player.position.x = this.animFrom.x + (this.animTo.x - this.animFrom.x) * e;
        this.player.position.z = this.animFrom.z + (this.animTo.z - this.animFrom.z) * e;
        this.turnIndicator.position.x = this.player.position.x;
        this.turnIndicator.position.z = this.player.position.z;
      } else if (this.animMode === 'attack') {
        this.attackSwingT = t;
        const swing = Math.sin(t * Math.PI) * 1.6;
        this.playerWeapon.rotation.z = -swing;
        this.playerWeapon.position.set(
          0.5 + Math.sin(t * Math.PI) * 0.3,
          0.8 + Math.sin(t * Math.PI) * 0.3,
          0.4,
        );
      }
      if (t >= 1) {
        this.isAnimating = false;
        this.animMode = 'none';
        if (this.attackSwingT > 0) {
          this.playerWeapon.rotation.z = 0;
          this.playerWeapon.position.set(0.4, 0.8, 0.3);
          this.attackSwingT = 0;
        }
      }
    }

    // Turn logic
    if (!this.isAnimating) {
      if (this.currentTurn === 'player') {
        this.processPlayerInput();
      } else {
        this.updateEnemyTurn(dt);
      }
    }

    // Periodic stats
    this.statsTimer += dt;
    if (this.statsTimer > 0.08) {
      this.statsTimer = 0;
      this.emitStats();
    }

    // Check death
    if (this.playerHp <= 0) {
      this.handleDeath();
      return;
    }

    // Just-pressed flags are cleared inside processPlayerInput once an action
    // is actually consumed (so blocked moves don't lose the key press).
  }

  private processPlayerInput() {
    if (!this.playerHasAction) return;

    let dx = 0, dy = 0;
    if (this.keysJustPressed['KeyW'] || this.keysJustPressed['ArrowUp']) dy = -1;
    else if (this.keysJustPressed['KeyS'] || this.keysJustPressed['ArrowDown']) dy = 1;
    else if (this.keysJustPressed['KeyA'] || this.keysJustPressed['ArrowLeft']) dx = -1;
    else if (this.keysJustPressed['KeyD'] || this.keysJustPressed['ArrowRight']) dx = 1;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
      // Always consume the buffered key press once it's been attempted
      this.keysJustPressed = {};
      return;
    }

    // Attack
    if (this.mouseClicked) {
      this.tryAttack();
      this.mouseClicked = false;
      return;
    }
  }

  private tryMove(dx: number, dy: number) {
    const tx = this.playerTileX + dx;
    const ty = this.playerTileY + dy;
    if (tx < 0 || ty < 0 || tx >= this.dungeon.width || ty >= this.dungeon.height) return;
    if (this.dungeon.cells[ty][tx] === 'wall') {
      // Blocked, no cost, just face direction
      this.playerFacing = Math.atan2(dx, dy);
      this.player.rotation.y = this.playerFacing;
      return;
    }
    if (this.occupiedTiles.has(`${tx},${ty}`)) {
      // Enemy on tile — face them instead
      this.playerFacing = Math.atan2(dx, dy);
      this.player.rotation.y = this.playerFacing;
      return;
    }
    // Valid move — single action consumed
    this.playerTileX = tx;
    this.playerTileY = ty;
    this.playerFacing = Math.atan2(dx, dy);
    this.player.rotation.y = this.playerFacing;
    this.animFrom.set(this.player.position.x, 0, this.player.position.z);
    this.animTo.set(tx * TILE, 0, ty * TILE);
    this.animTimer = 0;
    this.animDuration = MOVE_TWEEN_DURATION;
    this.animMode = 'move';
    this.isAnimating = true;
    this.playerHasAction = false;
    // Check loot pickup at new tile
    this.checkLootPickup(tx, ty);
    // Check extraction
    this.checkExtractionTile();
    this.afterPlayerAction();
  }

  private tryAttack() {
    if (this.weaponDurability <= 0) {
      this.logAction('Arma rotta!', '#ff4444');
      return;
    }
    // Face the mouse
    const dx = this.mouseWorld.x - this.player.position.x;
    const dz = this.mouseWorld.z - this.player.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.playerFacing = Math.atan2(dx, dz);
      this.player.rotation.y = this.playerFacing;
    }

    // Start attack animation
    this.animTimer = 0;
    this.animDuration = ATTACK_ANIM_DURATION;
    this.animMode = 'attack';
    this.isAnimating = true;
    this.playerHasAction = false;
    this.weaponDurability = Math.max(0, this.weaponDurability - 1);

    // Compute hits immediately (animation is cosmetic)
    // Weapon range is expressed in TILES — convert to world units for distance check.
    // Add a small buffer so that diagonal-adjacent enemies (√2 ≈ 1.414 tiles) are still
    // hittable by weapons with range 1.4 (like the starter knife).
    const rangeWorld = (this.weaponDef.range + 0.1) * TILE;
    const isRanged = this.weaponDef.class === 'ranged';
    let mightBonus = 1;
    if (!isRanged && this.playerMightBonus > 0) {
      mightBonus = 1 + this.playerMightBonus / 100;
    } else if (isRanged && this.playerFocusBonus > 0) {
      mightBonus = 1 + this.playerFocusBonus / 100;
    }
    let damage = this.weaponDef.damage * mightBonus;
    // Crit
    const isCrit = Math.random() * 100 < this.playerCritChance;
    if (isCrit) damage *= 2;
    damage = Math.floor(damage);

    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const edx = enemy.mesh.position.x - this.player.position.x;
      const edz = enemy.mesh.position.z - this.player.position.z;
      const dist = Math.sqrt(edx * edx + edz * edz);
      if (dist > rangeWorld) continue;
      if (isRanged) {
        const ang = Math.atan2(edx, edz);
        let dang = ang - this.playerFacing;
        while (dang > Math.PI) dang -= Math.PI * 2;
        while (dang < -Math.PI) dang += Math.PI * 2;
        if (Math.abs(dang) > 0.4) continue;
      } else {
        const ang = Math.atan2(edx, edz);
        let dang = ang - this.playerFacing;
        while (dang > Math.PI) dang -= Math.PI * 2;
        while (dang < -Math.PI) dang += Math.PI * 2;
        if (Math.abs(dang) > 1.2) continue;
      }
      this.damageEnemy(enemy, damage, isCrit);
      // No knockback in turn-based mode — keeps enemies in range for follow-up attacks
      hitCount += 1;
      if (isRanged) break;
    }

    const fx = Math.sin(this.playerFacing);
    const fz = Math.cos(this.playerFacing);
    const px = this.player.position.x + fx * rangeWorld * 0.5;
    const pz = this.player.position.z + fz * rangeWorld * 0.5;
    this.spawnParticles([px, 1, pz], this.weaponDef.color, isRanged ? 16 : 10);

    const critText = isCrit ? ' CRITICO!' : '';
    if (hitCount > 0) {
      this.logAction(
        `Attacco con ${this.weaponDef.name} → ${hitCount} bersaglio/i (${damage}${critText})`,
        isCrit ? '#fbbf24' : '#ffaa44',
      );
    } else {
      this.logAction(`Attacco a vuoto con ${this.weaponDef.name}`, '#888888');
    }
    this.afterPlayerAction();
  }

  private damageEnemy(enemy: Enemy, dmg: number, isCrit: boolean) {
    enemy.hp -= dmg;
    enemy.hitFlash = 0.2;
    this.damageDealt += dmg;
    this.spawnFloatingText(
      `${isCrit ? 'CRIT! ' : ''}${Math.floor(dmg)}`,
      [enemy.mesh.position.x, enemy.mesh.position.y + 2, enemy.mesh.position.z],
      isCrit ? '#fbbf24' : '#ffcc44',
    );
    this.updateHpBar(enemy);
    enemy.hpBar.visible = true;
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Enemy) {
    enemy.alive = false;
    this.kills += 1;
    const def = ENEMIES[enemy.kind as keyof typeof ENEMIES];
    this.spawnParticles(enemy.mesh.position.toArray() as Vec3, def.color, 24);
    this.spawnFloatingText(
      'MORTO',
      [enemy.mesh.position.x, enemy.mesh.position.y + 1.5, enemy.mesh.position.z],
      '#ff4444',
    );
    this.occupiedTiles.delete(`${enemy.tileX},${enemy.tileY}`);
    this.logAction(`${def.name} sconfitto (+${def.xpReward} XP)`, '#ff6644');
    // Drop loot
    if (Math.random() < def.lootChance) {
      this.spawnLoot(enemy.tileX, enemy.tileY);
    }
    this.scene.remove(enemy.mesh);
    enemy.mesh.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  private checkLootPickup(tx: number, ty: number) {
    for (let i = this.lootItems.length - 1; i >= 0; i--) {
      const li = this.lootItems[i];
      if (li.tileX === tx && li.tileY === ty) {
        this.pickupLoot(li);
        this.lootItems.splice(i, 1);
      }
    }
  }

  private pickupLoot(li: LootItem) {
    const item = li.item;
    this.scene.remove(li.mesh);
    li.mesh.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
    useGame.getState().addRaidLoot(item);
    let name = 'Item';
    let color = '#ffffff';
    if (item.type === 'weapon') {
      const w = WEAPON_MAP[item.defId];
      name = w?.name || 'Arma';
      color = w?.color || '#cccccc';
    } else if (item.type === 'consumable') {
      const c = CONSUMABLES[item.defId];
      name = c?.name || 'Consumabile';
      color = c?.color || '#cccccc';
    } else if (item.type === 'valuable') {
      name = `${item.value} Oro`;
      color = '#e8c547';
      this.carriedLootValue += item.value || 0;
    }
    this.spawnFloatingText(`+ ${name}`, [li.mesh.position.x, 1.2, li.mesh.position.z], color);
    this.spawnParticles([li.mesh.position.x, 0.5, li.mesh.position.z], color, 12);
    this.logAction(`Raccolto: ${name}`, color);
  }

  private checkExtractionTile() {
    const onExtraction = this.playerTileX === this.dungeon.extraction.x && this.playerTileY === this.dungeon.extraction.y;
    if (onExtraction) {
      this.extractionTurnsAccumulated += 1;
      this.logAction(`Sul portale: ${this.extractionTurnsAccumulated}/${EXTRACTION_TURNS_REQUIRED} turni`, '#33ff88');
      if (this.extractionTurnsAccumulated >= EXTRACTION_TURNS_REQUIRED) {
        this.handleExtract();
      }
    } else {
      if (this.extractionTurnsAccumulated > 0) {
        this.extractionTurnsAccumulated = 0;
      }
    }
  }

  private afterPlayerAction() {
    // Stoneshard-style: every player action immediately ends the turn
    const tryEnd = () => {
      if (this.disposed) return;
      if (this.currentTurn !== 'player') return;
      if (this.isAnimating) {
        setTimeout(tryEnd, 60);
        return;
      }
      this.startEnemyTurn();
    };
    setTimeout(tryEnd, 220);
  }

  private startEnemyTurn() {
    this.currentTurn = 'enemy';
    // Only consider enemies that are alive AND within relevant range of the player.
    // Far-away enemies idle and don't consume turn time — this keeps the enemy turn fast.
    this.enemyQueue = this.enemies.filter((e) => {
      if (!e.alive) return false;
      const dx = e.tileX - this.playerTileX;
      const dy = e.tileY - this.playerTileY;
      const distTiles = Math.sqrt(dx * dx + dy * dy);
      return distTiles <= ENEMY_RELEVANT_RANGE;
    });
    for (const e of this.enemyQueue) {
      const def = ENEMIES[e.kind as keyof typeof ENEMIES];
      e.actionsLeft = def.actionsPerTurn;
    }
    this.enemyActionTimer = 0.06;
    this.enemyActionInProgress = false;
    (this.turnIndicator.material as THREE.MeshBasicMaterial).color.setHex(0xff3344);
    (this.turnIndicator.material as THREE.MeshBasicMaterial).opacity = 0.7;
    this.logAction(`— Turno nemici —`, '#ff5555');
  }

  private updateEnemyTurn(dt: number) {
    this.enemyActionTimer -= dt;
    if (this.enemyActionTimer > 0) return;
    if (this.enemyQueue.length === 0) {
      // End enemy turn — back to player, restore their single action
      this.currentTurn = 'player';
      this.turnCount += 1;
      this.playerHasAction = true;
      (this.turnIndicator.material as THREE.MeshBasicMaterial).color.setHex(0x33ff55);
      (this.turnIndicator.material as THREE.MeshBasicMaterial).opacity = 0.6;
      this.logAction(`— Turno ${this.turnCount} (giocatore) —`, '#33ff88');
      this.enemyActionTimer = 0;
      return;
    }
    const enemy = this.enemyQueue[0];
    if (!enemy.alive) {
      this.enemyQueue.shift();
      this.enemyActionTimer = ENEMY_IDLE_DELAY;
      return;
    }
    if (enemy.actionsLeft <= 0) {
      this.enemyQueue.shift();
      this.enemyActionTimer = ENEMY_IDLE_DELAY;
      return;
    }
    const didAct = this.doEnemyAction(enemy);
    enemy.actionsLeft -= 1;
    // Only wait the full delay if the enemy actually did something visible
    this.enemyActionTimer = didAct ? ENEMY_ACTION_DELAY : ENEMY_IDLE_DELAY;
  }

  private doEnemyAction(enemy: Enemy): boolean {
    const def = ENEMIES[enemy.kind as keyof typeof ENEMIES];
    const dx = this.playerTileX - enemy.tileX;
    const dy = this.playerTileY - enemy.tileY;
    const distTiles = Math.sqrt(dx * dx + dy * dy);

    // Face the player
    if (dx !== 0 || dy !== 0) {
      enemy.mesh.rotation.y = Math.atan2(dx, dy);
    }

    // Attack if in range — attackRange is in world units, convert to tiles
    // (e.g. attackRange 1.4 → 0.7 tiles, so adjacent tile = attack range)
    const attackRangeTiles = def.attackRange / TILE + 0.6;
    if (distTiles <= attackRangeTiles) {
      this.damagePlayer(def.damage);
      this.spawnParticles(
        [this.player.position.x, 1, this.player.position.z],
        '#ff3333',
        10,
      );
      this.logAction(`${def.name} ti colpisce (${def.damage} danno)`, '#ff5555');
      return true;
    }

    // Move toward player (1 tile) if within detection range
    if (distTiles <= def.detectRange) {
      let mx = 0, my = 0;
      if (Math.abs(dx) > Math.abs(dy)) {
        mx = Math.sign(dx);
      } else if (Math.abs(dy) > 0) {
        my = Math.sign(dy);
      } else {
        mx = Math.sign(dx);
      }
      const nx = enemy.tileX + mx;
      const ny = enemy.tileY + my;
      if (nx < 0 || ny < 0 || nx >= this.dungeon.width || ny >= this.dungeon.height) return false;
      if (this.dungeon.cells[ny][nx] === 'wall') return false;
      if (this.occupiedTiles.has(`${nx},${ny}`)) return false;
      if (nx === this.playerTileX && ny === this.playerTileY) return false;
      // Move
      this.occupiedTiles.delete(`${enemy.tileX},${enemy.tileY}`);
      enemy.tileX = nx;
      enemy.tileY = ny;
      this.occupiedTiles.add(`${nx},${ny}`);
      this.tweenEnemyMove(enemy, nx, ny);
      return true;
    }

    // Enemy is too far to detect player — idle (no visible action)
    return false;
  }

  private tweenEnemyMove(enemy: Enemy, nx: number, ny: number) {
    const from = { x: enemy.mesh.position.x, z: enemy.mesh.position.z };
    const to = { x: nx * TILE, z: ny * TILE };
    const start = performance.now();
    const dur = 110;
    const animate = () => {
      if (this.disposed || !enemy.alive) return;
      const t = Math.min(1, (performance.now() - start) / dur);
      const e = easeOutCubic(t);
      enemy.mesh.position.x = from.x + (to.x - from.x) * e;
      enemy.mesh.position.z = from.z + (to.z - from.z) * e;
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  private damagePlayer(dmg: number) {
    if (this.playerInvuln) return;
    this.playerHp -= dmg;
    this.damageTaken += dmg;
    this.spawnFloatingText(
      `-${Math.floor(dmg)}`,
      [this.player.position.x, 1.8, this.player.position.z],
      '#ff4444',
    );
  }

  private updateLootBob(dt: number) {
    const t = performance.now() * 0.001;
    for (const li of this.lootItems) {
      li.mesh.position.y = 0.5 + Math.sin(t * 2 + li.bobOffset) * 0.12;
      li.mesh.rotation.y += dt * 1.2;
    }
    // Extraction pulse
    const s = 1 + Math.sin(performance.now() * 0.005) * 0.08;
    this.extractionMesh.scale.set(s, 1, s);
    this.extractionLight.intensity = 3.5 + Math.sin(performance.now() * 0.008) * 0.8;
  }

  private updateCamera(dt: number) {
    const target = this.player.position.clone();
    const desired = new THREE.Vector3(target.x, 13, target.z + 7);
    this.camera.position.lerp(desired, 0.08);
    this.camera.lookAt(target.x, 0.5, target.z);
  }

  private updateTorch() {
    this.torch.intensity = 2.2 + Math.sin(performance.now() * 0.012) * 0.3 + Math.sin(performance.now() * 0.05) * 0.15;
  }

  private updateTorches() {
    const t = performance.now() * 0.001;
    for (const torch of this.torches) {
      // Flicker: combination of slow + fast sine waves, unique per torch via baseSeed
      const flicker =
        Math.sin(t * 7 + torch.baseSeed) * 0.18 +
        Math.sin(t * 23 + torch.baseSeed * 2) * 0.08 +
        Math.sin(t * 51 + torch.baseSeed * 3) * 0.04;
      torch.light.intensity = 1.6 + flicker + 0.3;
      // Flame visual scale flicker
      const s = 1 + flicker * 0.6;
      torch.flame.scale.set(s, s * 1.4, s);
      // Color shift slightly toward red when dimmer
      const mat = torch.flame.material as THREE.MeshBasicMaterial;
      const dim = 0.85 + flicker * 0.5;
      mat.color.setRGB(1, 0.6 * dim + 0.2, 0.25 * dim);
    }
  }

  private updateHoverIndicator() {
    if (this.currentTurn !== 'player' || this.isAnimating) {
      this.hoverIndicator.visible = false;
      return;
    }
    const tx = Math.round(this.mouseWorld.x / TILE);
    const ty = Math.round(this.mouseWorld.z / TILE);
    const dx = tx - this.playerTileX;
    const dy = ty - this.playerTileY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Weapon range is in tiles; show indicator when within attack range OR adjacent
    const weaponRange = this.weaponDef.range;
    if (dist <= Math.max(1, weaponRange)) {
      this.hoverIndicator.visible = true;
      this.hoverIndicator.position.set(tx * TILE, 0.06, ty * TILE);
      const mat = this.hoverIndicator.material as THREE.MeshBasicMaterial;
      // Green if walkable adjacent, red if enemy, orange if attackable (but not adjacent)
      if (this.occupiedTiles.has(`${tx},${ty}`)) {
        mat.color.setHex(0xff3344);
      } else if (dist === 1 && this.dungeon.cells[ty] && this.dungeon.cells[ty][tx] !== 'wall') {
        mat.color.setHex(0x33ff55);
      } else {
        mat.color.setHex(0xffaa33);
      }
    } else {
      this.hoverIndicator.visible = false;
    }
  }

  private spawnFloatingText(text: string, pos: Vec3, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 128, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(pos[0], pos[1], pos[2]);
    sprite.scale.set(1.5, 0.4, 1);
    this.scene.add(sprite);
    this.floatingTexts.push({
      sprite,
      born: performance.now(),
      ttl: 1.2,
      vy: 1.0,
    });
  }

  private updateFloatingTexts(dt: number) {
    const now = performance.now();
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      const age = (now - ft.born) / 1000;
      ft.sprite.position.y += ft.vy * dt;
      const mat = ft.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, 1 - age / ft.ttl);
      if (age >= ft.ttl) {
        this.scene.remove(ft.sprite);
        (ft.sprite.material as THREE.SpriteMaterial).map?.dispose();
        (ft.sprite.material as THREE.SpriteMaterial).dispose();
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private spawnParticles(pos: Vec3, color: string, count: number) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      const ang = Math.random() * Math.PI * 2;
      const elev = Math.random() * 1.5;
      const sp = 1 + Math.random() * 3;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(ang) * sp,
        vy: elev * sp,
        vz: Math.sin(ang) * sp,
        born: performance.now(),
        ttl: 0.6 + Math.random() * 0.3,
      });
    }
  }

  private updateParticles(dt: number) {
    const now = performance.now();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const age = (now - p.born) / 1000;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - age / p.ttl);
      if (age >= p.ttl) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private handleExtract() {
    if (this.disposed) return;
    const stats: RunStats = {
      kills: this.kills,
      damageDealt: Math.floor(this.damageDealt),
      damageTaken: Math.floor(this.damageTaken),
      roomsCleared: 0,
      lootValue: this.carriedLootValue,
      timeAlive: (performance.now() - this.raidStart) / 1000,
      turnsPlayed: this.turnCount,
    };
    useGame.getState().extractRaid(stats);
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  private handleDeath() {
    if (this.disposed) return;
    const stats: RunStats = {
      kills: this.kills,
      damageDealt: Math.floor(this.damageDealt),
      damageTaken: Math.floor(this.damageTaken),
      roomsCleared: 0,
      lootValue: this.carriedLootValue,
      timeAlive: (performance.now() - this.raidStart) / 1000,
      turnsPlayed: this.turnCount,
    };
    useGame.getState().dieInRaid(stats);
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  private emitStats() {
    this.onStats({
      hp: Math.max(0, Math.floor(this.playerHp)),
      maxHp: this.playerMaxHp,
      hasAction: this.playerHasAction,
      currentTurn: this.currentTurn,
      turnCount: this.turnCount,
      weaponName: this.weaponDef.name,
      weaponApCost: this.weaponDef.apCost,
      weaponDurability: this.weaponDurability,
      weaponMaxDurability: this.weaponMaxDurability,
      lootCount: useGame.getState().raidLoot.length,
      lootValue: this.carriedLootValue,
      extractProgress: this.extractionTurnsAccumulated / EXTRACTION_TURNS_REQUIRED,
      nearExtraction: this.extractionTurnsAccumulated > 0,
      kills: this.kills,
      raidTime: (performance.now() - this.raidStart) / 1000,
      actionLog: this.actionLog.slice(0, 8).map((a) => ({
        text: a.text,
        color: a.color,
        turn: a.turn,
      })),
      consumables: this.carriedConsumables.map((c) => {
        const def = CONSUMABLES[c.defId];
        return {
          id: c.defId,
          uid: c.uid,
          name: def?.name || c.defId,
          color: def?.color || '#ffffff',
          qty: c.qty,
          heal: def?.healAmount || 0,
        };
      }),
      mightBonus: this.playerMightBonus,
      critChance: this.playerCritChance,
      isAnimating: this.isAnimating,
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    (this as any)._cleanupInput?.();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.scene?.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
