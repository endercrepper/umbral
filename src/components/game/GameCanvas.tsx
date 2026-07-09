// === UMBRAL: WebGL Game Engine (Three.js) ===
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useGame, makeItemUID } from '@/game/store';
import { generateDungeon, type DungeonData } from '@/game/dungeon';
import { WEAPON_MAP, randomWeapon, getWeapon } from '@/game/weapons';
import { ENEMIES, CONSUMABLES } from '@/game/enemies';
import type { RunStats, Vec3, WeaponDef } from '@/game/types';
import type { InventoryItem } from '@/game/store';

interface Enemy {
  mesh: THREE.Group;
  hpBar: THREE.Sprite;
  hp: number;
  maxHp: number;
  kind: string;
  vx: number;
  vz: number;
  lastAttack: number;
  alive: boolean;
  hitFlash: number;
}

interface LootItem {
  mesh: THREE.Object3D;
  item: InventoryItem;
  bobOffset: number;
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

const TILE = 2; // world units per dungeon tile
const PLAYER_SPEED = 4.5;
const PLAYER_HP_MAX = 100;
const PLAYER_STAMINA_MAX = 100;
const DASH_COST = 35;
const DASH_SPEED = 14;
const DASH_DURATION = 0.18;
const ATTACK_RANGE_BONUS = 0.5;
const EXTRACTION_TIME = 3.5;

export default function GameCanvas({ onStats }: { onStats: (s: { hp: number; maxHp: number; stamina: number; maxStamina: number; weaponName: string; weaponDurability: number; weaponMaxDurability: number; lootCount: number; lootValue: number; extractProgress: number; nearExtraction: boolean; kills: number; raidTime: number; consumables: { id: string; uid: string; name: string; color: string; qty: number; heal: number }[] }) => void }) {
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
      // Defer to escape effect body
      setTimeout(() => setError(e.message || String(e)), 0);
    }
    return () => {
      if (engine) engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Expose imperative API through window for HUD buttons
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      engineRef.current?.consumeItem(detail.uid);
    };
    window.addEventListener('umbral-consume', handler);
    return () => window.removeEventListener('umbral-consume', handler);
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

  // Game state
  private dungeon!: DungeonData;
  private player!: THREE.Group;
  private playerWeapon!: THREE.Mesh;
  private playerHp = PLAYER_HP_MAX;
  private playerStamina = PLAYER_STAMINA_MAX;
  private playerVx = 0;
  private playerVz = 0;
  private playerDashTime = 0;
  private playerAttackTime = 0;
  private playerAttackCooldown = 0;
  private playerInvuln = 0;
  private playerFacing = 0; // radians
  private playerRadius = 0.4;
  private playerPos = new THREE.Vector3();
  private playerExtractProgress = 0;

  // Input
  private keys: Record<string, boolean> = {};
  private mouseWorld = new THREE.Vector3();
  private mouseDown = false;

  // Entities
  private enemies: Enemy[] = [];
  private lootItems: LootItem[] = [];
  private floatingTexts: FloatingText[] = [];
  private particles: Particle[] = [];
  private walls: THREE.Mesh[] = [];
  private wallBounds: { x: number; z: number; hw: number; hh: number }[] = [];
  private extractionMesh!: THREE.Mesh;
  private extractionLight!: THREE.PointLight;
  private torch!: THREE.PointLight;

  // Equipped weapon
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

  // Callbacks
  private onStats: (s: any) => void;
  private statsTimer = 0;

  // Materials (reused)
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.mount.appendChild(this.renderer.domElement);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.045);

    this.camera = new THREE.PerspectiveCamera(
      55,
      this.mount.clientWidth / this.mount.clientHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 18, 8);
    this.camera.lookAt(0, 0, 0);

    // Ambient very dim
    const ambient = new THREE.AmbientLight(0x1a1f3a, 0.45);
    this.scene.add(ambient);

    // Hemisphere light - cold sky, warm ground
    const hemi = new THREE.HemisphereLight(0x2a3050, 0x100805, 0.3);
    this.scene.add(hemi);

    // Directional "moon" light
    const dir = new THREE.DirectionalLight(0x4a5278, 0.35);
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

    // Materials
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
      // Fallback
      this.weaponDef = WEAPON_MAP['flint_knife'];
      this.weaponDurability = 50;
      this.weaponMaxDurability = 50;
    }
    this.carriedConsumables = gs.carriedConsumables.map((c) => ({
      uid: c.uid,
      defId: c.defId,
      qty: c.qty || 0,
    }));
  }

  private initDungeon() {
    const seed = Math.floor(Math.random() * 1000000);
    const diff = useGame.getState().difficulty;
    this.dungeon = generateDungeon(seed, diff);

    const tileGeom = new THREE.PlaneGeometry(TILE, TILE);
    tileGeom.rotateX(-Math.PI / 2);

    const wallGeom = new THREE.BoxGeometry(TILE, TILE * 1.6, TILE);

    // Floor & walls
    const floorGroup = new THREE.Group();
    const wallGroup = new THREE.Group();
    this.scene.add(floorGroup);
    this.scene.add(wallGroup);

    for (let y = 0; y < this.dungeon.height; y++) {
      for (let x = 0; x < this.dungeon.width; x++) {
        const cell = this.dungeon.cells[y][x];
        if (cell === 'wall') continue;
        // Floor
        const floor = new THREE.Mesh(tileGeom, this.matFloor);
        floor.position.set(x * TILE, 0, y * TILE);
        floor.receiveShadow = true;
        floorGroup.add(floor);

        // Surrounding walls
        for (const [dx, dy] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= this.dungeon.width ||
            ny >= this.dungeon.height
          )
            continue;
          if (this.dungeon.cells[ny][nx] === 'wall') {
            const wmesh = new THREE.Mesh(wallGeom, this.matWall);
            wmesh.position.set(nx * TILE, TILE * 0.8, ny * TILE);
            wmesh.castShadow = true;
            wmesh.receiveShadow = true;
            wallGroup.add(wmesh);
            this.walls.push(wmesh);
            this.wallBounds.push({
              x: nx * TILE,
              z: ny * TILE,
              hw: TILE / 2,
              hh: TILE / 2,
            });
          }
        }
      }
    }

    // Loot spots
    for (const spot of this.dungeon.lootSpots) {
      this.spawnLoot(spot.x, spot.y);
    }

    // Extraction portal
    const ext = this.dungeon.extraction;
    const extGeom = new THREE.CircleGeometry(TILE * 0.6, 24);
    extGeom.rotateX(-Math.PI / 2);
    const extMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.7,
    });
    this.extractionMesh = new THREE.Mesh(extGeom, extMat);
    this.extractionMesh.position.set(ext.x * TILE, 0.05, ext.y * TILE);
    this.scene.add(this.extractionMesh);

    this.extractionLight = new THREE.PointLight(0x00ff88, 3, 12);
    this.extractionLight.position.set(ext.x * TILE, 1.5, ext.y * TILE);
    this.scene.add(this.extractionLight);

    // Spawn enemies
    for (const es of this.dungeon.enemySpawns) {
      this.spawnEnemy(es.x, es.y, es.kind);
    }

    // Save player spawn
    this.playerPos.set(
      this.dungeon.spawn.x * TILE,
      0,
      this.dungeon.spawn.y * TILE,
    );
  }

  private initPlayer() {
    this.player = new THREE.Group();

    // Body (cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.35, 0.4, 1.4, 12);
    const body = new THREE.Mesh(bodyGeom, this.matPlayer);
    body.position.y = 0.7;
    body.castShadow = true;
    this.player.add(body);

    // Head
    const headGeom = new THREE.SphereGeometry(0.28, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xd4c4a8,
      roughness: 0.7,
    });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    this.player.add(head);

    // Cape (cone)
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

    // Weapon
    const wpnColor = new THREE.Color(this.weaponDef.color);
    const wpnMat = new THREE.MeshStandardMaterial({
      color: wpnColor,
      roughness: 0.4,
      metalness: 0.6,
      emissive: wpnColor,
      emissiveIntensity: 0.15,
    });
    this.playerWeapon = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.0, 0.12),
      wpnMat,
    );
    this.playerWeapon.position.set(0.4, 0.8, 0.3);
    this.playerWeapon.castShadow = true;
    this.player.add(this.playerWeapon);

    // Player torch (warm light)
    this.torch = new THREE.PointLight(0xff8844, 2.5, 14, 1.8);
    this.torch.position.set(0, 2, 0);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(512, 512);
    this.player.add(this.torch);

    this.player.position.copy(this.playerPos);
    this.scene.add(this.player);
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
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.7,
          metalness: 0.1,
        }),
      );
      bodyMesh.position.y = 0.5 * def.scale;
      // Add spikes
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
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.3,
          metalness: 0.7,
        }),
      );
      bodyMesh.position.y = 0.85 * def.scale;
      // Helmet
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 * def.scale, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a3a,
          metalness: 0.8,
          roughness: 0.2,
        }),
      );
      helm.position.y = 1.65 * def.scale;
      group.add(helm);
    } else if (kind === 'cultist') {
      const g = new THREE.CylinderGeometry(0.35 * def.scale, 0.55 * def.scale, 1.6 * def.scale, 8);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.8,
          metalness: 0.05,
        }),
      );
      bodyMesh.position.y = 0.8 * def.scale;
      // Hood
      const hood = new THREE.Mesh(
        new THREE.ConeGeometry(0.4 * def.scale, 0.6 * def.scale, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a0a1a, roughness: 0.9 }),
      );
      hood.position.y = 1.65 * def.scale;
      group.add(hood);
    } else {
      // wretch - hunched
      const g = new THREE.SphereGeometry(0.45 * def.scale, 8, 6);
      bodyMesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.85,
        }),
      );
      bodyMesh.position.y = 0.55 * def.scale;
      bodyMesh.scale.y = 1.3;
    }
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    group.position.set(tileX * TILE, 0, tileY * TILE);
    this.scene.add(group);

    // HP bar sprite
    const hpBar = this.makeHpBarSprite();
    hpBar.position.set(0, 2.2 * def.scale, 0);
    group.add(hpBar);

    this.enemies.push({
      mesh: group,
      hpBar,
      hp: def.maxHp,
      maxHp: def.maxHp,
      kind,
      vx: 0,
      vz: 0,
      lastAttack: 0,
      alive: true,
      hitFlash: 0,
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
      // Generate random loot
      const r = Math.random();
      if (r < 0.55) {
        // Weapon
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
        // Consumable
        const cKey = Math.random() < 0.6 ? 'herb' : Math.random() < 0.7 ? 'potion' : 'elixir';
        lootItem = {
          uid: makeItemUID(),
          type: 'consumable',
          defId: cKey,
          qty: Math.floor(Math.random() * 2) + 1,
        };
      } else {
        // Valuable
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
      emissiveIntensity: 0.5,
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

    // Glow halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 16),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.3,
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
    });
  }

  private initInput() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
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
      // Intersect ground plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      ray.ray.intersectPlane(plane, hit);
      if (hit) this.mouseWorld.copy(hit);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = true;
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

    // Store for cleanup
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
    const idx = this.carriedConsumables.findIndex((c) => c.uid === uid);
    if (idx < 0) return;
    const c = this.carriedConsumables[idx];
    const def = CONSUMABLES[c.defId];
    if (!def) return;
    this.playerHp = Math.min(PLAYER_HP_MAX, this.playerHp + def.healAmount);
    this.spawnFloatingText(`+${def.healAmount} HP`, this.player.position.toArray() as Vec3, '#33ff55');
    this.spawnParticles(this.player.position.toArray() as Vec3, '#33ff55', 16);
    c.qty -= 1;
    if (c.qty <= 0) this.carriedConsumables.splice(idx, 1);
  }

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateLoot(dt);
    this.updateFloatingTexts(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateExtraction(dt);

    // Periodic stats emit (10/s)
    this.statsTimer += dt;
    if (this.statsTimer > 0.1) {
      this.statsTimer = 0;
      this.emitStats();
    }

    // Check death
    if (this.playerHp <= 0) {
      this.handleDeath();
      return;
    }

    // Check weapon broken
    if (this.weaponDurability <= 0) {
      // Just don't attack anymore
    }
  }

  private updatePlayer(dt: number) {
    // Movement
    let mx = 0;
    let mz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
    }

    // Dash
    if (this.playerDashTime > 0) {
      this.playerDashTime -= dt;
    } else if (this.keys['ShiftLeft'] && moving && this.playerStamina >= DASH_COST) {
      this.playerDashTime = DASH_DURATION;
      this.playerStamina -= DASH_COST;
      this.playerVx = mx * DASH_SPEED;
      this.playerVz = mz * DASH_SPEED;
      this.playerInvuln = Math.max(this.playerInvuln, DASH_DURATION);
      this.spawnParticles(this.player.position.toArray() as Vec3, '#aaaaff', 12);
    }

    let speed: number;
    if (this.playerDashTime > 0) {
      speed = DASH_SPEED;
      this.playerVx *= 0.92;
      this.playerVz *= 0.92;
      this.player.position.x += this.playerVx * dt;
      this.player.position.z += this.playerVz * dt;
    } else {
      speed = PLAYER_SPEED;
      const tx = mx * speed;
      const tz = mz * speed;
      this.playerVx = THREE.MathUtils.lerp(this.playerVx, tx, 0.25);
      this.playerVz = THREE.MathUtils.lerp(this.playerVz, tz, 0.25);
      this.player.position.x += this.playerVx * dt;
      this.player.position.z += this.playerVz * dt;
    }

    // Collide with walls (simple AABB)
    this.resolvePlayerCollisions();

    // Face mouse direction
    const dx = this.mouseWorld.x - this.player.position.x;
    const dz = this.mouseWorld.z - this.player.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.playerFacing = Math.atan2(dx, dz);
      this.player.rotation.y = this.playerFacing;
    }

    // Attack
    this.playerAttackCooldown -= dt;
    if (this.mouseDown && this.playerAttackCooldown <= 0 && this.weaponDurability > 0) {
      this.performAttack();
    }
    if (this.playerAttackTime > 0) {
      this.playerAttackTime -= dt;
      // Weapon swing animation
      const swingT = 1 - Math.max(0, this.playerAttackTime / 0.25);
      const swingAngle = Math.sin(swingT * Math.PI) * 1.6;
      this.playerWeapon.rotation.z = -swingAngle;
      this.playerWeapon.position.set(
        0.5 + Math.sin(swingT * Math.PI) * 0.3,
        0.8 + Math.sin(swingT * Math.PI) * 0.3,
        0.4,
      );
    } else {
      this.playerWeapon.rotation.z = 0;
      this.playerWeapon.position.set(0.4, 0.8, 0.3);
    }

    // Stamina regen
    if (!this.keys['ShiftLeft']) {
      this.playerStamina = Math.min(
        PLAYER_STAMINA_MAX,
        this.playerStamina + 18 * dt,
      );
    }

    // Invuln
    if (this.playerInvuln > 0) this.playerInvuln -= dt;

    // Torch flicker
    this.torch.intensity = 2.2 + Math.sin(performance.now() * 0.012) * 0.3 + Math.sin(performance.now() * 0.05) * 0.15;
  }

  private resolvePlayerCollisions() {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const r = this.playerRadius;
    for (const b of this.wallBounds) {
      const dx = px - Math.max(b.x - b.hw, Math.min(px, b.x + b.hw));
      const dz = pz - Math.max(b.z - b.hh, Math.min(pz, b.z + b.hh));
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (r - d) / d;
        this.player.position.x += dx * push;
        this.player.position.z += dz * push;
      }
    }
    // Clamp to dungeon
    this.player.position.x = THREE.MathUtils.clamp(
      this.player.position.x,
      0,
      (this.dungeon.width - 1) * TILE,
    );
    this.player.position.z = THREE.MathUtils.clamp(
      this.player.position.z,
      0,
      (this.dungeon.height - 1) * TILE,
    );
  }

  private performAttack() {
    const aps = this.weaponDef.attackSpeed;
    this.playerAttackCooldown = 1 / aps;
    this.playerAttackTime = 0.25;
    this.weaponDurability = Math.max(0, this.weaponDurability - 1);

    const range = this.weaponDef.range + ATTACK_RANGE_BONUS;
    const damage = this.weaponDef.damage;
    const fx = Math.sin(this.playerFacing);
    const fz = Math.cos(this.playerFacing);

    // Find enemies in arc
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.mesh.position.x - this.player.position.x;
      const dz = enemy.mesh.position.z - this.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range) continue;
      // Check angle (within ~70 degrees of facing)
      const ang = Math.atan2(dx, dz);
      let dang = ang - this.playerFacing;
      while (dang > Math.PI) dang -= Math.PI * 2;
      while (dang < -Math.PI) dang += Math.PI * 2;
      if (Math.abs(dang) > 1.2) continue;
      // Hit!
      this.damageEnemy(enemy, damage);
      // Knockback
      const kb = 1.5;
      enemy.mesh.position.x += (dx / dist) * kb;
      enemy.mesh.position.z += (dz / dist) * kb;
    }

    // Spawn attack particles
    const px = this.player.position.x + fx * range * 0.5;
    const pz = this.player.position.z + fz * range * 0.5;
    this.spawnParticles([px, 1, pz], this.weaponDef.color, 8);
  }

  private damageEnemy(enemy: Enemy, dmg: number) {
    enemy.hp -= dmg;
    enemy.hitFlash = 0.15;
    this.damageDealt += dmg;
    this.spawnFloatingText(
      `${Math.floor(dmg)}`,
      [enemy.mesh.position.x, enemy.mesh.position.y + 2, enemy.mesh.position.z],
      '#ffcc44',
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
    this.spawnParticles(
      enemy.mesh.position.toArray() as Vec3,
      def.color,
      24,
    );
    this.spawnFloatingText(
      'MORTO',
      [enemy.mesh.position.x, enemy.mesh.position.y + 1.5, enemy.mesh.position.z],
      '#ff4444',
    );
    // Drop loot
    if (Math.random() < def.lootChance) {
      const tileX = Math.round(enemy.mesh.position.x / TILE);
      const tileY = Math.round(enemy.mesh.position.z / TILE);
      this.spawnLoot(tileX, tileY);
    }
    // Remove mesh
    this.scene.remove(enemy.mesh);
    enemy.mesh.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  private updateEnemies(dt: number) {
    const now = performance.now() / 1000;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const def = ENEMIES[enemy.kind as keyof typeof ENEMIES];
      const dx = this.player.position.x - enemy.mesh.position.x;
      const dz = this.player.position.z - enemy.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Hit flash
      if (enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        const body = enemy.mesh.children[0] as THREE.Mesh;
        if (body && (body.material as THREE.MeshStandardMaterial)) {
          (body.material as THREE.MeshStandardMaterial).emissive.setRGB(1, 0.3, 0.3);
          (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;
        }
      } else {
        const body = enemy.mesh.children[0] as THREE.Mesh;
        if (body && (body.material as THREE.MeshStandardMaterial)) {
          const baseColor = new THREE.Color(def.color);
          (body.material as THREE.MeshStandardMaterial).emissive.copy(baseColor);
          (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        }
      }

      // AI: if player within detect range, chase
      if (dist < def.detectRange) {
        if (dist > def.attackRange) {
          // Move toward player
          const sp = def.speed;
          enemy.mesh.position.x += (dx / dist) * sp * dt;
          enemy.mesh.position.z += (dz / dist) * sp * dt;
          // Face player
          enemy.mesh.rotation.y = Math.atan2(dx, dz);
        } else {
          // Attack
          if (now - enemy.lastAttack > def.attackCooldown) {
            enemy.lastAttack = now;
            this.damagePlayer(def.damage);
            // Attack visual
            this.spawnParticles(
              [this.player.position.x, 1, this.player.position.z],
              '#ff3333',
              8,
            );
          }
        }
      } else {
        // Idle wander
        if (Math.random() < 0.01) {
          enemy.vx = (Math.random() - 0.5) * def.speed * 0.4;
          enemy.vz = (Math.random() - 0.5) * def.speed * 0.4;
        }
        enemy.mesh.position.x += enemy.vx * dt;
        enemy.mesh.position.z += enemy.vz * dt;
      }

      // Clamp to dungeon bounds
      enemy.mesh.position.x = THREE.MathUtils.clamp(
        enemy.mesh.position.x,
        0,
        (this.dungeon.width - 1) * TILE,
      );
      enemy.mesh.position.z = THREE.MathUtils.clamp(
        enemy.mesh.position.z,
        0,
        (this.dungeon.height - 1) * TILE,
      );

      // HP bar fade
      if (now - enemy.lastAttack > 4 && enemy.hp >= enemy.maxHp) {
        // Hide HP bar when out of combat and full HP
      }
    }
    // Clean up dead
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private damagePlayer(dmg: number) {
    if (this.playerInvuln > 0) return;
    this.playerHp -= dmg;
    this.damageTaken += dmg;
    this.playerInvuln = 0.4;
    this.spawnFloatingText(
      `-${Math.floor(dmg)}`,
      [this.player.position.x, 1.8, this.player.position.z],
      '#ff4444',
    );
    // Camera shake could be added
    if (this.playerHp < 30) {
      // low HP vignette handled by HUD
    }
  }

  private updateLoot(dt: number) {
    const t = performance.now() * 0.001;
    for (let i = this.lootItems.length - 1; i >= 0; i--) {
      const li = this.lootItems[i];
      // Bob & rotate
      li.mesh.position.y = 0.5 + Math.sin(t * 2 + li.bobOffset) * 0.15;
      li.mesh.rotation.y += dt * 1.5;
      // Pickup
      const dx = this.player.position.x - li.mesh.position.x;
      const dz = this.player.position.z - li.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.9) {
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
    // Add to raid loot
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
    this.spawnFloatingText(
      `+ ${name}`,
      [li.mesh.position.x, 1.2, li.mesh.position.z],
      color,
    );
    this.spawnParticles(
      [li.mesh.position.x, 0.5, li.mesh.position.z],
      color,
      12,
    );
  }

  private updateExtraction(dt: number) {
    const dx = this.player.position.x - this.extractionMesh.position.x;
    const dz = this.player.position.z - this.extractionMesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const near = dist < 1.2;
    if (near) {
      this.playerExtractProgress += dt;
      // Pulse
      const s = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      this.extractionMesh.scale.set(s, 1, s);
      if (this.playerExtractProgress >= EXTRACTION_TIME) {
        this.handleExtract();
      }
    } else {
      this.playerExtractProgress = Math.max(0, this.playerExtractProgress - dt * 2);
    }
  }

  private updateCamera(dt: number) {
    // Smooth follow
    const target = this.player.position.clone();
    const desired = new THREE.Vector3(target.x, 16, target.z + 9);
    this.camera.position.lerp(desired, 0.08);
    this.camera.lookAt(target.x, 0.5, target.z);
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
      ttl: 1.0,
      vy: 1.2,
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
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 1,
      });
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
    };
    // Persist carried consumables (only the ones used survive in store; we just trust the engine state)
    useGame.getState().extractRaid(stats);
    // Stop
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
    };
    useGame.getState().dieInRaid(stats);
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  private emitStats() {
    this.onStats({
      hp: Math.max(0, Math.floor(this.playerHp)),
      maxHp: PLAYER_HP_MAX,
      stamina: Math.floor(this.playerStamina),
      maxStamina: PLAYER_STAMINA_MAX,
      weaponName: this.weaponDef.name,
      weaponDurability: this.weaponDurability,
      weaponMaxDurability: this.weaponMaxDurability,
      lootCount: useGame.getState().raidLoot.length,
      lootValue: this.carriedLootValue,
      extractProgress: this.playerExtractProgress / EXTRACTION_TIME,
      nearExtraction: this.playerExtractProgress > 0,
      kills: this.kills,
      raidTime: (performance.now() - this.raidStart) / 1000,
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
    // Dispose all materials/geometries
    this.scene?.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
