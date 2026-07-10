// === UMBRAL: Procedural Dungeon Generator ===
// Generates a grid-based dungeon with rooms, corridors, loot, and extraction point.

export type CellType = 'floor' | 'wall' | 'door' | 'loot' | 'extraction' | 'spawn';

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

export function generateDungeon(seed: number, difficulty: number = 1): DungeonData {
  const rng = makeRng(seed);
  const width = 48;
  const height = 48;
  const cells: CellType[][] = [];

  // Fill with walls
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

    rooms.push({
      x,
      y,
      w,
      h,
      cx: Math.floor(x + w / 2),
      cy: Math.floor(y + h / 2),
    });

    // Carve room
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        cells[ry][rx] = 'floor';
      }
    }
  }

  // Connect rooms with corridors (L-shaped)
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

  // Add some extra corridors for loops
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

  // Designate spawn (first room), extraction (farthest room), boss (farthest from spawn among non-extraction)
  rooms[0].isSpawn = true;
  // Find room with max distance from spawn
  let farthestIdx = 1;
  let farthestDist = 0;
  for (let i = 1; i < rooms.length; i++) {
    const d = dist(rooms[0].cx, rooms[0].cy, rooms[i].cx, rooms[i].cy);
    if (d > farthestDist) {
      farthestDist = d;
      farthestIdx = i;
    }
  }
  rooms[farthestIdx].isBoss = true;

  // Find second farthest for extraction
  let secondIdx = 1;
  let secondDist = 0;
  for (let i = 1; i < rooms.length; i++) {
    if (i === farthestIdx) continue;
    const d = dist(rooms[0].cx, rooms[0].cy, rooms[i].cx, rooms[i].cy);
    if (d > secondDist) {
      secondDist = d;
      secondIdx = i;
    }
  }
  rooms[secondIdx].isExtraction = true;

  // Place loot spots in random rooms
  const lootSpots: { x: number; y: number }[] = [];
  const lootCount = Math.floor(rooms.length * 0.6);
  for (let i = 0; i < lootCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    if (room.isSpawn || room.isExtraction) continue;
    const lx = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ly = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ly][lx] === 'floor') {
      cells[ly][lx] = 'loot';
      lootSpots.push({ x: lx, y: ly });
    }
  }

  // Place enemy spawns
  const enemySpawns: { x: number; y: number; kind: string }[] = [];
  const enemyCount = 6 + difficulty * 3;
  const enemyPool: string[] = difficulty < 2
    ? ['wretch', 'wretch', 'cultist', 'beast']
    : difficulty < 4
    ? ['wretch', 'cultist', 'cultist', 'knight', 'beast']
    : ['cultist', 'knight', 'knight', 'beast', 'beast'];
  for (let i = 0; i < enemyCount; i++) {
    const room = rooms[Math.floor(rng() * rooms.length)];
    if (room.isSpawn) continue;
    const ex = room.x + 1 + Math.floor(rng() * (room.w - 2));
    const ey = room.y + 1 + Math.floor(rng() * (room.h - 2));
    if (cells[ey][ex] === 'floor' || cells[ey][ex] === 'loot') {
      const kind = enemyPool[Math.floor(rng() * enemyPool.length)];
      enemySpawns.push({ x: ex, y: ey, kind });
    }
  }

  // Boss spawn
  const bossRoom = rooms[farthestIdx];
  enemySpawns.push({ x: bossRoom.cx, y: bossRoom.cy, kind: 'boss' });
  cells[bossRoom.cy][bossRoom.cx] = 'floor';

  // Mark extraction tile
  const extRoom = rooms[secondIdx];
  cells[extRoom.cy][extRoom.cx] = 'extraction';

  return {
    width,
    height,
    cells,
    rooms,
    spawn: { x: rooms[0].cx, y: rooms[0].cy },
    extraction: { x: extRoom.cx, y: extRoom.cy },
    boss: { x: bossRoom.cx, y: bossRoom.cy },
    lootSpots,
    enemySpawns,
  };
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

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
