'use strict';
const World = (() => {
  const CS = CFG.CHUNK_SIZE;
  const TILE_SZ = 4;

  function getHeight(x, z) {
    const h1 = Math.sin(x * 0.045) * Math.cos(z * 0.045) * 3.8;
    const h2 = Math.sin(x * 0.11 + 1.2) * Math.cos(z * 0.085 - 0.8) * 1.9;
    const h3 = Math.cos(x * 0.22 - z * 0.18) * 0.85;
    return h1 + h2 + h3;
  }

  function getGroundColor(x, z) {
    const h = getHeight(x, z);
    let hash = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
    
    if (h > 2.2) {
      if (hash > 0.4) return { hue: 42, sat: 35, lit: 26, type: 'dry' };
      return { hue: 28, sat: 22, lit: 22, type: 'rocky' };
    } else if (h < -1.8) {
      if (hash > 0.5) return { hue: 28, sat: 38, lit: 14, type: 'mud' };
      return { hue: 135, sat: 32, lit: 12, type: 'darkmoss' };
    } else {
      if (hash < 0.18) return { hue: 32, sat: 42, lit: 20, type: 'dirt' };
      if (hash > 0.82) return { hue: 48, sat: 48, lit: 24, type: 'drypatch' };
      return { hue: 95 + hash * 25, sat: 35 + hash * 20, lit: 16 + hash * 10, type: 'grass' };
    }
  }

  const TYPES = [
    ['TALL_TREE',   8,  0.35],
    ['ROUND_TREE',  9,  0.38],
    ['PINE',        7,  0.30],
    ['OAK',         5,  0.42],
    ['DEAD_TREE',   2,  0.25],
    ['BUSH',       12,  0.15],
    ['FERN',       14,  0.00],
    ['TALL_GRASS', 22,  0.00],
    ['FLOWER',      9,  0.00],
    ['MUSHROOM',    5,  0.00],
    ['ROCK',        7,  0.25],
  ];
  const TW = TYPES.reduce((s,[,w])=>s+w, 0);

  function mkLCG(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff; };
  }
  function cSeed(cx, cz) {
    let h = ((cx * 73856093) ^ (cz * 19349663)) >>> 0;
    h ^= h >>> 16; h = (Math.imul(h, 0x45d9f3b)) >>> 0;
    h ^= h >>> 16; h = (Math.imul(h, 0x45d9f3b)) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function pickType(r) {
    let p = r() * TW;
    for (const [type, w, colR] of TYPES) { p -= w; if (p <= 0) return { type, colR }; }
    const L = TYPES[TYPES.length - 1]; return { type: L[0], colR: L[2] };
  }

  function genEnt(type, colR, x, z, r) {
    const wy = getHeight(x, z);
    const e = { type, colR, x, z, wy };
    switch (type) {
      case 'TALL_TREE':
        e.sc = 0.8 + r() * 1.8; e.lean = (r() - .5) * .18;
        e.hue = 100 + r() * 35; e.sat = 42 + r() * 30; e.lit = 13 + r() * 18;
        e.trH = 2.8 + r() * 2.4; e.caH = 5.5 + r() * 3.5; e.caW = 2.2 + r() * 1.8;
        break;
      case 'ROUND_TREE':
        e.sc = 0.65 + r() * 1.3; e.lean = (r() - .5) * .12;
        e.hue = 88 + r() * 48; e.sat = 33 + r() * 40; e.lit = 15 + r() * 22;
        e.trH = 1.2 + r() * 1.8; e.caH = 3.5 + r() * 3.2; e.caW = 4.0 + r() * 3.2;
        break;
      case 'PINE':
        e.sc = 0.9 + r() * 1.5; e.hue = 112 + r() * 22; e.sat = 38 + r() * 32; e.lit = 10 + r() * 16;
        e.trH = 2.0 + r() * 2.5; e.layers = 3 + Math.floor(r() * 3);
        break;
      case 'OAK':
        e.sc = 1.0 + r() * 1.5; e.lean = (r() - .5) * .1;
        e.hue = 88 + r() * 38; e.sat = 26 + r() * 38; e.lit = 16 + r() * 22;
        e.trH = 1.5 + r() * 1.5; e.blobs = 3 + Math.floor(r() * 4);
        e.blobO = [];
        for (let i = 0; i < e.blobs; i++) e.blobO.push([(r() - .5) * 2, r() * 1.5, 0.9 + r() * .9]);
        break;
      case 'DEAD_TREE':
        e.sc = 0.8 + r() * 1.2; e.lean = (r() - .5) * .22;
        e.trH = 3.0 + r() * 2.5; e.brs = 2 + Math.floor(r() * 3);
        e.brA = [];
        for (let i = 0; i < e.brs; i++) e.brA.push([(r() - .5) * 1.2, 0.55 + r() * .8, 0.4 + r() * .55]);
        break;
      case 'BUSH':
        e.sc = 0.35 + r() * .95; e.hue = 90 + r() * 60; e.sat = 30 + r() * 42; e.lit = 15 + r() * 26;
        e.blobs = 2 + Math.floor(r() * 4);
        e.blobO = [];
        for (let i = 0; i < e.blobs; i++) e.blobO.push([(r() - .5) * 1.4, r() * .65, 0.55 + r() * .85]);
        break;
      case 'FERN':
        e.sc = 0.22 + r() * .7; e.hue = 105 + r() * 48; e.sat = 46 + r() * 32; e.lit = 15 + r() * 24;
        e.fronds = 4 + Math.floor(r() * 5); e.spread = 0.35 + r() * .55;
        break;
      case 'TALL_GRASS':
        e.sc = 0.18 + r() * .5; e.hue = 88 + r() * 48; e.sat = 40 + r() * 40; e.lit = 18 + r() * 30;
        e.blades = 3 + Math.floor(r() * 5); e.sway = (r() - .5) * .38;
        break;
      case 'FLOWER':
        e.sc = 0.12 + r() * .34; e.stemH = 0.7 + r() * 1.4;
        e.pHue = Math.floor(r() * 360); e.pSat = 55 + r() * 35; e.pLit = 48 + r() * 38;
        e.petals = 4 + Math.floor(r() * 5);
        break;
      case 'MUSHROOM':
        e.sc = 0.18 + r() * .58; e.cHue = r() < .5 ? (r() * 35) : (200 + r() * 110);
        e.cSat = 52 + r() * 38; e.cLit = 30 + r() * 35; e.spotted = r() > .42;
        break;
      case 'ROCK':
        e.sc = 0.28 + r() * .95; e.sides = 5 + Math.floor(r() * 4);
        e.flat = 0.32 + r() * .46; e.grey = 28 + Math.floor(r() * 55);
        e.jit = [];
        for (let i = 0; i < e.sides + 1; i++) e.jit.push(0.78 + r() * .44);
        break;
    }
    return e;
  }

  // Generate City Skyscraper Building
  function genBuilding(x, z, r) {
    const wy = getHeight(x, z);
    return {
      type: 'BUILDING',
      x, z, wy,
      w: 3.5 + r() * 4.0,       // Building width
      h: 12.0 + r() * 22.0,     // Skyscraper height
      hue: [200, 215, 230, 280, 45][Math.floor(r() * 5)],
      sat: 60 + r() * 35,
      lit: 25 + r() * 30,
      windowCols: 3 + Math.floor(r() * 4),
      windowRows: 6 + Math.floor(r() * 8),
      roofAntenna: r() > 0.4
    };
  }

  function genChunk(cx, cz) {
    const r = mkLCG(cSeed(cx, cz));
    const n = 14 + Math.floor(r() * 14);
    const ents = [];
    for (let i = 0; i < n; i++) {
      const lx = r() * CS, lz = r() * CS;
      const { type, colR } = pickType(r);
      ents.push(genEnt(type, colR, cx * CS + lx, cz * CS + lz, r));
    }

    // Generate 3-5 City Buildings per chunk (rise up during transition)
    const buildings = [];
    const bCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < bCount; i++) {
      const bx = cx * CS + r() * CS;
      const bz = cz * CS + r() * CS;
      buildings.push(genBuilding(bx, bz, r));
    }

    // Generate 3D ground sub-tiles
    const tiles = [];
    const tilesPerAxis = CS / TILE_SZ;
    for (let tx = 0; tx < tilesPerAxis; tx++) {
      for (let tz = 0; tz < tilesPerAxis; tz++) {
        const x0 = cx * CS + tx * TILE_SZ;
        const z0 = cz * CS + tz * TILE_SZ;
        const x1 = x0 + TILE_SZ;
        const z1 = z0 + TILE_SZ;

        const p0 = { x: x0, z: z0, y: getHeight(x0, z0) };
        const p1 = { x: x1, z: z0, y: getHeight(x1, z0) };
        const p2 = { x: x1, z: z1, y: getHeight(x1, z1) };
        const p3 = { x: x0, z: z1, y: getHeight(x0, z1) };

        const centerColor = getGroundColor(x0 + TILE_SZ * 0.5, z0 + TILE_SZ * 0.5);
        tiles.push({ p0, p1, p2, p3, color: centerColor });
      }
    }

    return { ents, buildings, tiles };
  }

  const chunks = new Map();
  const key = (cx, cz) => `${cx},${cz}`;
  function getChunk(cx, cz) {
    const k = key(cx, cz);
    if (!chunks.has(k)) chunks.set(k, genChunk(cx, cz));
    return chunks.get(k);
  }

  function prune(px, pz) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const PR = CFG.PRUNE_RADIUS;
    for (const k of chunks.keys()) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > PR || Math.abs(cz - pcz) > PR) chunks.delete(k);
    }
  }

  function getEntities(px, pz, ang) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    const R = CFG.LOAD_RADIUS, outEnts = [], outTiles = [], outBuildings = [];
    const sin = Math.sin(ang), cos = Math.cos(ang);

    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const fwd = dx * sin + dz * cos;
        const side = Math.abs(dx * cos - dz * sin);

        const maxDist = (fwd >= -0.5) ? R : Math.ceil(R * 0.4);
        const maxSide = (fwd >= -0.5) ? Math.ceil(R * 0.8) : Math.ceil(R * 0.4);

        if (Math.hypot(dx, dz) <= maxDist && side <= maxSide) {
          const c = getChunk(pcx + dx, pcz + dz);
          for (const e of c.ents) outEnts.push(e);
          for (const b of c.buildings) outBuildings.push(b);
          for (const t of c.tiles) outTiles.push(t);
        }
      }
    }
    return { ents: outEnts, buildings: outBuildings, tiles: outTiles };
  }

  function getNearEntities(px, pz) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), out = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const e of getChunk(pcx + dx, pcz + dz).ents) if (e.colR > 0) out.push(e);
    return out;
  }

  return { getHeight, getGroundColor, getEntities, getNearEntities, prune };
})();
