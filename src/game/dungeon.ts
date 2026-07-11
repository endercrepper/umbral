// === UMBRAL: Procedural Map Generator (Stoneshard-style open world) ===
// Grid-based maps with edge transitions. Village at center, wilderness/dungeon/boss radiating outward.

export type CellType = 'floor' | 'wall' | 'door' | 'loot' | 'extraction' | 'spawn';

export type MapType = 'village' | 'wilderness' | 'dungeon' | 'boss';

export interface DungeonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  isSpawn?: boolean;
  isExtraction?: boolean;
  isBoss?: boolean;
}

export interface DungeonData {
  width: number;
  height: number;
  cells: CellType[][];
  rooms: DungeonRoom[];
  spawn: { x: number; y: number };
  extraction: { x: number; y: number };
  boss: { x: number; y: number };
  lootSpots: { x: number; y: number }[];
  enemySpawns: { x: number; y: number; kind: string }[];
  type: MapType;
  gridX: number;
  gridY: number;
}

// Seeded RNG (mulberry32)
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCoords(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

export const MAP_TYPE_LABEL: Record<MapType, string> = {
  village: 'Villaggio di Bruma',
  wilderness: 'Terre Incolte',
  dungeon: 'Cripte Profonde',
  boss: 'Voragine del Signore',
};

export const MAP_TYPE_COLOR: Record<MapType, string> = {
  village: '#4ade80',
  wilderness: '#c9a04a',
  dungeon: '#c05050',
  boss: '#a020a0',
};

export function getMapTypeForGrid(gridX: number, gridY: number): MapType {
  const dist = Math.max(Math.abs(gridX), Math.abs(gridY));
  if (dist === 0) return 'village';
  if (dist <= 2) return 'wilderness';
  if (dist <= 4) return 'dungeon';
  return 'boss';
}

export function generateMap(gridX: number, gridY: number, difficulty: number = 1): DungeonData {
  const type = getMapTypeForGrid(gridX, gridY);
  const seed = hashCoords(gridX, gridY);
  switch (type) {
    case 'village':
      return generateVillage(gridX, gridY, seed);
    case 'wilderness':
      return generateWilderness(gridX, gridY, seed, difficulty);
    case 'dungeon':
      return generateDungeonMap(gridX, gridY, seed, difficulty);
    case 'boss':
      return generateBossArea(gridX, gridY, seed, difficulty);
  }
}

// === Edge exit carving ===
// Creates 3-tile-wide gaps at the center of each edge for map transitions.
function carveEdgeExits(cells: CellType[][], width: number, height: number) {
  const cx = Math.floor(width / 2);
  for (let i = -1; i <= 1; i++) {
    if (cells[0]) cells[0][cx + i] = 'floor';
    if (cells[height - 1]) cells[height - 1][cx + i] = 'floor';
    if (cells[cx + i]) cells[cx + i][0] = 'floor';
    if (cells[cx + i]) cells[cx + i][width - 1] = 'floor';
  }
}

// === VILLAGE ===
function generateVillage(gridX: number, gridY: number, seed: number): DungeonData {
  const rng = makeRng(seed);
  const width = 32;
  const height = 32;
  const cells: CellType[][] = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = 'floor';
    }
  }

  for (let x = 0; x < width; x++) {
    cells[0][x] = 'wall';
    cells[height - 1][x] = 'wall';
  }
  for (let y = 0; y < height; y++) {
    cells[y][0] = 'wall';
    cells[y][width - 1] = 'wall';
  }

  carveEdgeExits(cells, width, height);

  // Buildings — keep central cross corridor clear
  const cx0 = Math.floor(width / 2);
  const cy0 = Math.floor(height / 2);
  const corridorHalfWidth = 2;
  const isOnCorridor = (x: number, y: number) =>
    Math.abs(x - cx0) <= corridorHalfWidth || Math.abs(y - cy0) <= corridorHalfWidth;

  const buildings = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < buildings; i++) {
    const bw = 4 + Math.floor(rng() * 4);
    const bh = 4 + Math.floor(rng() * 4);
    const bx = 4 + Math.floor(rng() * (width - bw - 8));
    const by = 4 + Math.floor(rng() * (height - bh - 8));

    if (isOnCorridor(bx, by) || isOnCorridor(bx + bw - 1, by + bh - 1)) continue;

    for (let x = bx; x < bx + bw; x++) {
      cells[by][x] = 'wall';
      cells[by + bh - 1][x] = 'wall';
    }
    for (let y = by; y < by + bh; y++) {
      cells[y][bx] = 'wall';
      cells[y][bx + bw - 1] = 'wall';
    }
    const doorSide = Math.floor(rng() * 4);
    const doorPos = 1 + Math.floor(rng() * (Math.min(bw, bh) - 2));
    if (doorSide === 0) cells[by][bx + doorPos] = 'floor';
    else if (doorSide === 1) cells[by + bh - 1][bx + doorPos] = 'floor';
    else if (doorSide === 2) cells[by + doorPos][bx] = 'floor';
    else cells[by + doorPos][bx + bw - 1] = 'floor';
  }

  // Trees — keep corridor clear
  const trees = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < trees; i++) {
    const tx = 2 + Math.floor(rng() * (width - 4));
    const ty = 2 + Math.floor(rng() * (height - 4));
    if (Math.abs(tx - cx0) <= corridorHalfWidth || Math.abs(ty - cy0) <= corridorHalfWidth) continue;
    if (cells[ty][tx] === 'floor') {
      cells[ty][tx] = 'wall';
    }
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  cells[cy][cx] = 'extraction';

  return {
    width,
    height,
    cells,
    rooms: [],
    spawn: { x: cx, y: cy },
    extraction: { x: cx, y: cy },
    boss: { x: cx, y: cy },
    lootSpots: [],
    enemySpawns: [],
    type: 'village',
    gridX,
    gridY,
  };
}

// === WILDERNESS ===
function generateWilderness(gridX: number, gridY: number, seed: number, difficulty: number): DungeonData {
  const rng = makeRng(seed);
  const width = 40;
  const height = 40;
  const cells: CellType[][] = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = 'wall';
    }
  }

  const rooms: DungeonRoom[] = [];
  const maxRooms = 5 + Math.floor(difficulty * 0.8);
  const minSize = 5;
  const maxSize = 9;

  let attempts = 0;
  while (rooms.length < maxRooms && attempts < 150) {
    attempts++;
    const w = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
    const h = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
    const x = Math.floor(rng() * (width - w - 2)) + 1;
    const y = Math.floor(rng() * (height - h - 2)) + 1;

    const overlaps = rooms.some(
      (r) =>
        x < r.x + r.w + 1 &&
        x + w + 1 > r.x &&
        y < r.y + r.h + 1 &&
        y + h + 1 > r.y,
    );
    if (overlaps) continue;

    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });

    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        cells[ry][rx] = 'floor';
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    if (rng() < 0.5) {
      carveH(cells, prev.cx, curr.cx, prev.cy);
      carveV(cells, prev.cy, curr.cy, curr.cx);
    } else {
      carveV(cells, prev.cy, curr.cy, prev.cx);
      carveH(cells, prev.cx, curr.cx, curr.cy);
    }
  }

  carveEdgeExits(cells, width, height);

  const lootSpots: { x: number; y: number }[] = [];
  const lootCount = Math.floor(rooms.length * 0.5);
  for (let i = 0; i < lootCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    const lx = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ly = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ly][lx] === 'floor') {
      cells[ly][lx] = 'loot';
      lootSpots.push({ x: lx, y: ly });
    }
  }

  const enemySpawns: { x: number; y: number; kind: string }[] = [];
  const enemyCount = 3 + difficulty * 2;
  const enemyPool = ['wretch', 'wretch', 'beast'];
  for (let i = 0; i < enemyCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    if (room.cx === Math.floor(width / 2) && room.cy === Math.floor(height / 2)) continue;
    const ex = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ey = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ey][ex] === 'floor' || cells[ey][ex] === 'loot') {
      const kind = enemyPool[Math.floor(rng() * enemyPool.length)];
      enemySpawns.push({ x: ex, y: ey, kind });
    }
  }

  let spawnX = Math.floor(width / 2);
  let spawnY = Math.floor(height / 2);
  if (cells[spawnY][spawnX] === 'wall') {
    for (let r = 1; r < 5; r++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = spawnX + dx;
          const ny = spawnY + dy;
          if (cells[ny] && cells[ny][nx] === 'floor') {
            spawnX = nx;
            spawnY = ny;
            found = true;
          }
        }
      }
      if (found) break;
    }
  }

  return {
    width,
    height,
    cells,
    rooms,
    spawn: { x: spawnX, y: spawnY },
    extraction: { x: -1, y: -1 },
    boss: { x: -1, y: -1 },
    lootSpots,
    enemySpawns,
    type: 'wilderness',
    gridX,
    gridY,
  };
}

// === DUNGEON ===
function generateDungeonMap(gridX: number, gridY: number, seed: number, difficulty: number): DungeonData {
  const rng = makeRng(seed);
  const width = 48;
  const height = 48;
  const cells: CellType[][] = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = 'wall';
    }
  }

  const rooms: DungeonRoom[] = [];
  const maxRooms = 8 + Math.floor(difficulty * 1.5);
  const minSize = 5;
  const maxSize = 10;

  let attempts = 0;
  while (rooms.length < maxRooms && attempts < 200) {
    attempts++;
    const w = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
    const h = Math.floor(rng() * (maxSize - minSize + 1)) + minSize;
    const x = Math.floor(rng() * (width - w - 2)) + 1;
    const y = Math.floor(rng() * (height - h - 2)) + 1;

    const overlaps = rooms.some(
      (r) =>
        x < r.x + r.w + 1 &&
        x + w + 1 > r.x &&
        y < r.y + r.h + 1 &&
        y + h + 1 > r.y,
    );
    if (overlaps) continue;

    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });

    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        cells[ry][rx] = 'floor';
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    if (rng() < 0.5) {
      carveH(cells, prev.cx, curr.cx, prev.cy);
      carveV(cells, prev.cy, curr.cy, curr.cx);
    } else {
      carveV(cells, prev.cy, curr.cy, prev.cx);
      carveH(cells, prev.cx, curr.cx, curr.cy);
    }
  }

  const extraCorridors = Math.floor(rooms.length * 0.3);
  for (let i = 0; i < extraCorridors; i++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a === b) continue;
    if (rng() < 0.5) {
      carveH(cells, a.cx, b.cx, a.cy);
      carveV(cells, a.cy, b.cy, b.cx);
    } else {
      carveV(cells, a.cy, b.cy, a.cx);
      carveH(cells, a.cx, b.cx, b.cy);
    }
  }

  carveEdgeExits(cells, width, height);

  const lootSpots: { x: number; y: number }[] = [];
  const lootCount = Math.floor(rooms.length * 0.7);
  for (let i = 0; i < lootCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    const lx = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ly = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ly][lx] === 'floor') {
      cells[ly][lx] = 'loot';
      lootSpots.push({ x: lx, y: ly });
    }
  }

  const enemySpawns: { x: number; y: number; kind: string }[] = [];
  const enemyCount = 6 + difficulty * 3;
  const enemyPool: string[] = difficulty < 2
    ? ['wretch', 'wretch', 'cultist', 'beast']
    : difficulty < 4
    ? ['wretch', 'cultist', 'cultist', 'knight', 'beast']
    : ['cultist', 'knight', 'knight', 'beast', 'beast'];
  for (let i = 0; i < enemyCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    const ex = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ey = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ey][ex] === 'floor' || cells[ey][ex] === 'loot') {
      const kind = enemyPool[Math.floor(rng() * enemyPool.length)];
      enemySpawns.push({ x: ex, y: ey, kind });
    }
  }

  let spawnX = Math.floor(width / 2);
  let spawnY = Math.floor(height / 2);
  if (cells[spawnY][spawnX] === 'wall') {
    for (let r = 1; r < 5; r++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = spawnX + dx;
          const ny = spawnY + dy;
          if (cells[ny] && cells[ny][nx] === 'floor') {
            spawnX = nx;
            spawnY = ny;
            found = true;
          }
        }
      }
      if (found) break;
    }
  }

  return {
    width,
    height,
    cells,
    rooms,
    spawn: { x: spawnX, y: spawnY },
    extraction: { x: -1, y: -1 },
    boss: { x: -1, y: -1 },
    lootSpots,
    enemySpawns,
    type: 'dungeon',
    gridX,
    gridY,
  };
}

// === BOSS AREA ===
function generateBossArea(gridX: number, gridY: number, seed: number, difficulty: number): DungeonData {
  const rng = makeRng(seed);
  const width = 28;
  const height = 28;
  const cells: CellType[][] = [];

  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = 'floor';
    }
  }

  for (let x = 0; x < width; x++) {
    cells[0][x] = 'wall';
    cells[height - 1][x] = 'wall';
  }
  for (let y = 0; y < height; y++) {
    cells[y][0] = 'wall';
    cells[y][width - 1] = 'wall';
  }

  carveEdgeExits(cells, width, height);

  const pillars = 6;
  for (let i = 0; i < pillars; i++) {
    const px = 4 + Math.floor(rng() * (width - 8));
    const py = 4 + Math.floor(rng() * (height - 8));
    cells[py][px] = 'wall';
    if (rng() < 0.5 && px + 1 < width - 1) cells[py][px + 1] = 'wall';
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  const enemySpawns: { x: number; y: number; kind: string }[] = [
    { x: cx, y: cy, kind: 'boss' },
  ];

  const minionCount = 3 + Math.floor(difficulty * 0.5);
  for (let i = 0; i < minionCount; i++) {
    const ang = (i / minionCount) * Math.PI * 2;
    const mx = cx + Math.round(Math.cos(ang) * 4);
    const my = cy + Math.round(Math.sin(ang) * 4);
    if (cells[my] && cells[my][mx] === 'floor') {
      enemySpawns.push({ x: mx, y: my, kind: 'knight' });
    }
  }

  const lootSpots: { x: number; y: number }[] = [];
  const lootCount = 5;
  for (let i = 0; i < lootCount; i++) {
    const lx = 3 + Math.floor(rng() * (width - 6));
    const ly = 3 + Math.floor(rng() * (height - 6));
    if (cells[ly][lx] === 'floor') {
      cells[ly][lx] = 'loot';
      lootSpots.push({ x: lx, y: ly });
    }
  }

  return {
    width,
    height,
    cells,
    rooms: [],
    spawn: { x: cx, y: cy - 5 < 1 ? 2 : cy + 5 },
    extraction: { x: -1, y: -1 },
    boss: { x: cx, y: cy },
    lootSpots,
    enemySpawns,
    type: 'boss',
    gridX,
    gridY,
  };
}

// === Legacy: backward compat (old generateDungeon calls) ===
export function generateDungeon(seed: number, difficulty: number = 1): DungeonData {
  return generateDungeonMap(0, 0, seed, difficulty);
}

function carveH(cells: CellType[][], x1: number, x2: number, y: number) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    if (cells[y] && cells[y][x] !== undefined && cells[y][x] !== 'extraction' && cells[y][x] !== 'loot') {
      cells[y][x] = 'floor';
    }
  }
}

function carveV(cells: CellType[][], y1: number, y2: number, x: number) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    if (cells[y] && cells[y][x] !== undefined && cells[y][x] !== 'extraction' && cells[y][x] !== 'loot') {
      cells[y][x] = 'floor';
    }
  }
}
