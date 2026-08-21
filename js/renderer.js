'use strict';
const Renderer = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('canvas');

  // ── SVG Object Pool (Eliminates GC Memory Leaks) ─────────────────────────
  const pool = {
    polygon: [],
    g: [],
    path: [],
    rect: [],
    circle: [],
    line: [],
    ellipse: []
  };
  const poolIdx = { polygon: 0, g: 0, path: 0, rect: 0, circle: 0, line: 0, ellipse: 0 };

  function resetPool() {
    for (const key in poolIdx) poolIdx[key] = 0;
  }

  function getPooled(tag, attrs = {}) {
    const p = pool[tag];
    const idx = poolIdx[tag]++;
    let el;
    if (idx < p.length) {
      el = p[idx];
      el.style.display = '';
    } else {
      el = document.createElementNS(NS, tag);
      p.push(el);
    }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function hideUnusedPooled() {
    for (const tag in pool) {
      const p = pool[tag];
      const activeCount = poolIdx[tag];
      for (let i = activeCount; i < p.length; i++) {
        p[i].style.display = 'none';
      }
    }
  }

  function mkStatic(tag, a = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    return e;
  }

  // ── Permanent Static Layer Setup ─────────────────────────────────────────
  const defs = mkStatic('defs');
  const skyG = mkStatic('linearGradient', { id: 'sG', x1: '0', y1: '0', x2: '0', y2: '1' });
  const ss0 = mkStatic('stop', { offset: '0%' }), ss1 = mkStatic('stop', { offset: '55%' }), ss2 = mkStatic('stop', { offset: '100%' });
  skyG.append(ss0, ss1, ss2);

  const gndG = mkStatic('linearGradient', { id: 'gG', x1: '0', y1: '0', x2: '0', y2: '1' });
  const gs0 = mkStatic('stop', { offset: '0%' }), gs1 = mkStatic('stop', { offset: '100%' });
  gndG.append(gs0, gs1);
  defs.append(skyG, gndG);
  svg.append(defs);

  const skyR   = mkStatic('rect', { x: 0, y: 0, fill: 'url(#sG)' });
  const starsG = mkStatic('g');
  const celG   = mkStatic('g');
  const gndR   = mkStatic('rect', { x: 0, fill: 'url(#gG)' });
  const mistR  = mkStatic('rect', { x: 0, height: '28' });
  const sceneG = mkStatic('g', { id: 'scene' }); // Unified depth layer
  const leafG  = mkStatic('g', { id: 'leaves' });
  const vigR   = mkStatic('rect', { x: 0, y: 0, fill: '#000', opacity: '0.14', 'pointer-events': 'none' });
  svg.append(skyR, starsG, celG, gndR, mistR, sceneG, leafG, vigR);

  // Static Stars
  Sky.STARS.forEach(s => {
    starsG.append(mkStatic('circle', { cx: s.x + '%', cy: s.y + '%', r: s.r, fill: '#fff', opacity: s.b.toFixed(2) }));
  });

  const sunGlow = mkStatic('circle', { r: '52', fill: 'rgba(255,238,110,0.13)' });
  const sunEl   = mkStatic('circle', { r: '21', fill: '#fff6b0' });
  const moonEl  = mkStatic('circle', { r: '16', fill: '#dce8fa' });
  celG.append(sunGlow, sunEl, moonEl);

  const EYE_H  = 1.65;
  const VSCALE = 0.24;

  function resize() {
    const w = innerWidth, h = innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    skyR.setAttribute('width', w);  skyR.setAttribute('height', h * 0.5);
    gndR.setAttribute('width', w);  gndR.setAttribute('y', h * 0.5); gndR.setAttribute('height', h * 0.5);
    mistR.setAttribute('width', w); mistR.setAttribute('y', h * 0.495);
    vigR.setAttribute('width', w);  vigR.setAttribute('height', h);
  }
  addEventListener('resize', resize); resize();

  function proj(wx, wy, wz, px, py, pz, ang, bobX = 0, shakeX = 0, shakeY = 0) {
    const effX = px + Math.cos(ang) * bobX;
    const effZ = pz - Math.sin(ang) * bobX;
    const dx = wx - effX, dy = wy - py, dz = wz - effZ;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = dx * ca - dz * sa;
    const cz = dx * sa + dz * ca;
    if (cz < CFG.NEAR || cz > CFG.FAR) return null;

    const fp = 1 / Math.atan(CFG.FOV / 2);
    const w = innerWidth, h = innerHeight;
    const sx = w * (0.5 + 0.5 * (cx / cz) * fp) + shakeX;
    const ps = fp / cz;
    const df = ps * h * VSCALE;
    const sy = h * 0.5 - (dy / cz) * fp * h * VSCALE + shakeY;
    return { sx, sy, cz, ps, df, w, h };
  }

  function projTerrainCorner(wx, wy, wz, px, py, pz, ang, bobX = 0, shakeX = 0, shakeY = 0) {
    const effX = px + Math.cos(ang) * bobX;
    const effZ = pz - Math.sin(ang) * bobX;
    const dx = wx - effX, dy = wy - py, dz = wz - effZ;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = dx * ca - dz * sa;
    const cz = dx * sa + dz * ca;
    const safeZ = Math.max(0.12, cz);
    const fp = 1 / Math.atan(CFG.FOV / 2);
    const w = innerWidth, h = innerHeight;
    const sx = w * (0.5 + 0.5 * (cx / safeZ) * fp) + shakeX;
    const sy = h * 0.5 - (dy / safeZ) * fp * h * VSCALE + shakeY;
    return { sx, sy, cz, safeZ };
  }

  function applyLit(hue, sat, l, sky) {
    const a = sky.amb, t = sky.t;
    let hs = 0;
    if (t < 0.30 || t > 0.72) hs = (t < 0.50 ? -14 : -10);
    if (t > 0.87 || t < 0.12) hs = 10;
    return 'hsl(' + (hue + hs) + ',' + Math.max(0, sat * (0.20 + a * 0.80)).toFixed(0) + '%,' + Math.max(2, l * (0.10 + a * 0.90)).toFixed(0) + '%)';
  }
  function applyDark(h2, s, l, sky) { return applyLit(h2, s, l * 0.50, sky); }
  function fogA(cz) { return Math.min(1, Math.max(0.04, 1 - (cz - CFG.NEAR) / (CFG.FAR * 0.76))); }

  function drawTerrainTile(tile, player, py, sky, shakeX = 0, shakeY = 0) {
    const bX = player.bobX || 0;
    const p0 = projTerrainCorner(tile.p0.x, tile.p0.y, tile.p0.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p1 = projTerrainCorner(tile.p1.x, tile.p1.y, tile.p1.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p2 = projTerrainCorner(tile.p2.x, tile.p2.y, tile.p2.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p3 = projTerrainCorner(tile.p3.x, tile.p3.y, tile.p3.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);

    if (p0.cz < 0.05 && p1.cz < 0.05 && p2.cz < 0.05 && p3.cz < 0.05) return null;
    if (p0.cz > CFG.FAR && p1.cz > CFG.FAR && p2.cz > CFG.FAR && p3.cz > CFG.FAR) return null;

    const avgCz = (Math.max(0.1, p0.cz) + Math.max(0.1, p1.cz) + Math.max(0.1, p2.cz) + Math.max(0.1, p3.cz)) * 0.25;
    const pts = `${p0.sx.toFixed(1)},${p0.sy.toFixed(1)} ${p1.sx.toFixed(1)},${p1.sy.toFixed(1)} ${p2.sx.toFixed(1)},${p2.sy.toFixed(1)} ${p3.sx.toFixed(1)},${p3.sy.toFixed(1)}`;
    const baseCol = applyLit(tile.color.hue, tile.color.sat, tile.color.lit, sky);

    const poly = getPooled('polygon', { points: pts, fill: baseCol, opacity: '1.0' });
    return { poly, cz: avgCz };
  }

  function dBuilding(b, p, sky, riseProgress = 1.0) {
    const { sx, sy: base, df } = p;
    const bW = b.w * df, bH = b.h * df * riseProgress;
    if (bH <= 1) return null;

    const col = applyLit(b.hue, b.sat, b.lit, sky);
    const sideCol = applyDark(b.hue, b.sat, b.lit, sky);
    const winCol = 'hsl(45, 95%, ' + Math.floor(60 + sky.amb * 30) + '%)';

    const g = getPooled('g', { opacity: Math.min(1.0, riseProgress * 1.2).toFixed(2) });
    const topY = base - bH;

    g.append(getPooled('rect', {
      x: (sx - bW * 0.5).toFixed(1), y: topY.toFixed(1),
      width: bW.toFixed(1), height: bH.toFixed(1),
      fill: col, stroke: '#080c14', 'stroke-width': '1'
    }));

    const dW = bW * 0.25;
    g.append(getPooled('polygon', {
      points: `${(sx + bW * 0.5).toFixed(1)},${base.toFixed(1)} ${(sx + bW * 0.5 + dW).toFixed(1)},${(base - dW * 0.5).toFixed(1)} ${(sx + bW * 0.5 + dW).toFixed(1)},${(topY - dW * 0.5).toFixed(1)} ${(sx + bW * 0.5).toFixed(1)},${topY.toFixed(1)}`,
      fill: sideCol
    }));

    const rows = Math.min(4, b.windowRows), cols = Math.min(3, b.windowCols);
    const wW = bW * 0.16, wH = bH / (rows * 1.8);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = sx - bW * 0.38 + c * (bW * 0.24);
        const wy = topY + bH * 0.10 + r * (bH * 0.80 / rows);
        g.append(getPooled('rect', {
          x: wx.toFixed(1), y: wy.toFixed(1),
          width: wW.toFixed(1), height: wH.toFixed(1),
          fill: winCol, opacity: (0.55 + ((r + c) % 3) * 0.20).toFixed(2)
        }));
      }
    }

    if (b.roofAntenna) {
      g.append(getPooled('line', {
        x1: sx.toFixed(1), y1: topY.toFixed(1),
        x2: sx.toFixed(1), y2: (topY - bW * 0.6).toFixed(1),
        stroke: '#e74c3c', 'stroke-width': '2'
      }));
      g.append(getPooled('circle', {
        cx: sx.toFixed(1), cy: (topY - bW * 0.6).toFixed(1),
        r: '2', fill: '#ff3333'
      }));
    }
    return g;
  }

  function trunkP(sx, base, trH, trW, lean) {
    const tx = sx + lean * trH, hw = trW / 2;
    return 'M' + (sx - hw) + ',' + base + ' L' + (sx + hw) + ',' + base + ' L' + (tx + hw) + ',' + (base - trH) + ' L' + (tx - hw) + ',' + (base - trH) + 'Z';
  }
  function tear(cx, tipY, botY, midY, cw) {
    const l1 = cx - cw * .74, l2 = cx - cw * .52, r1 = cx + cw * .74, r2 = cx + cw * .52;
    return 'M' + cx + ',' + botY +
      ' C' + l1 + ',' + midY + ' ' + l2 + ',' + (tipY + cw * .32) + ' ' + cx + ',' + tipY +
      ' C' + r2 + ',' + (tipY + cw * .32) + ' ' + r1 + ',' + midY + ' ' + cx + ',' + botY + 'Z';
  }

  function dTallTree(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc, lean = e.lean;
    const trH = e.trH * sc * df, caH = e.caH * sc * df, caW = e.caW * sc * df;
    const trW = Math.max(2, caW * .16), lx = sx + lean * trH;
    const tipY = base - trH - caH * .72, botY = base - trH + caH * .22, midY = base - trH - caH * .18;
    const col = applyLit(e.hue, e.sat, e.lit, sky), drk = applyDark(e.hue, e.sat, e.lit, sky);
    const trC = applyLit(25, 42, 11, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(
      getPooled('path', { d: trunkP(sx, base, trH, trW, lean), fill: trC }),
      getPooled('path', { d: tear(lx, tipY, botY, midY, caW), fill: col }),
      getPooled('path', { d: 'M' + lx + ',' + botY + ' C' + (lx + caW * .1) + ',' + midY + ' ' + (lx + caW * .1) + ',' + (tipY + caW * .32) + ' ' + lx + ',' + tipY + ' C' + (lx + caW * .52) + ',' + (tipY + caW * .32) + ' ' + (lx + caW * .74) + ',' + midY + ' ' + lx + ',' + botY + 'Z', fill: drk, opacity: '.52' }),
    );
    return g;
  }

  function dRoundTree(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc, lean = e.lean;
    const trH = e.trH * sc * df, caH = e.caH * sc * df, caW = e.caW * sc * df;
    const trW = Math.max(2, caW * .18), lx = sx + lean * trH;
    const tipY = base - trH - caH * .58, botY = base - trH + caH * .30, midY = base - trH - caH * .04;
    const col = applyLit(e.hue, e.sat, e.lit, sky), drk = applyDark(e.hue, e.sat, e.lit, sky);
    const trC = applyLit(25, 42, 11, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(
      getPooled('path', { d: trunkP(sx, base, trH, trW, lean), fill: trC }),
      getPooled('path', { d: tear(lx, tipY, botY, midY, caW), fill: col }),
      getPooled('path', { d: 'M' + lx + ',' + botY + ' C' + (lx + caW * .14) + ',' + midY + ' ' + (lx + caW * .14) + ',' + (tipY + caW * .26) + ' ' + lx + ',' + tipY + ' C' + (lx + caW * .55) + ',' + (tipY + caW * .26) + ' ' + (lx + caW * .76) + ',' + midY + ' ' + lx + ',' + botY + 'Z', fill: drk, opacity: '.46' })
    );
    return g;
  }

  function dPine(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const trH = e.trH * sc * df, trW = Math.max(2, 2.8 * sc * df * .12);
    const n = Math.min(3, e.layers), col = applyLit(e.hue, e.sat, e.lit, sky), drk = applyDark(e.hue, e.sat, e.lit, sky);
    const trC = applyLit(25, 38, 11, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('path', { d: trunkP(sx, base, trH, trW, 0), fill: trC }));
    const lH = 3.2 * sc * df / n;
    for (let i = 0; i < n; i++) {
      const t = i / n, w = (2.8 * sc * df) * (1 - t * .52);
      const layBase = base - trH - i * lH * .68, tip = layBase - lH * 1.2;
      g.append(
        getPooled('path', { d: 'M' + (sx - w) + ',' + layBase + ' L' + (sx + w) + ',' + layBase + ' L' + sx + ',' + tip + 'Z', fill: col }),
        getPooled('path', { d: 'M' + sx + ',' + layBase + ' L' + (sx + w) + ',' + layBase + ' L' + sx + ',' + tip + 'Z', fill: drk, opacity: '.48' })
      );
    }
    return g;
  }

  function dOak(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc, lean = e.lean;
    const trH = e.trH * sc * df, trW = Math.max(3, 4 * sc * df * .13);
    const lx = sx + lean * trH, bs = 2.2 * sc * df;
    const col = applyLit(e.hue, e.sat, e.lit, sky);
    const trC = applyLit(25, 38, 11, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('path', { d: trunkP(sx, base, trH, trW, lean), fill: trC }));
    for (let i = 0; i < Math.min(3, e.blobO.length); i++) {
      const [ox, oy, or] = e.blobO[i];
      const bx = (lx + ox * bs * .52).toFixed(1), by = (base - trH - oy * bs * .62).toFixed(1);
      const rx = (or * bs * .72).toFixed(1), ry = (or * bs * .58).toFixed(1);
      g.append(getPooled('ellipse', { cx: bx, cy: by, rx, ry, fill: col, opacity: '.90' }));
    }
    return g;
  }

  function dDeadTree(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc, lean = e.lean;
    const trH = e.trH * sc * df, trW = Math.max(2, 2.4 * sc * df * .12);
    const lx = sx + lean * trH;
    const col = applyLit(25, 18, 18, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('path', { d: trunkP(sx, base, trH, trW, lean), fill: col }));
    for (let i = 0; i < Math.min(2, e.brA.length); i++) {
      const [bang, blen, bpos] = e.brA[i];
      const bsy = base - trH * bpos, bsx = lx + (lean * trH) * (1 - bpos);
      const bex = bsx + Math.cos(bang) * blen * trH * .52;
      const bey = bsy - Math.abs(Math.sin(bang)) * blen * trH * .35;
      g.append(getPooled('line', { x1: bsx.toFixed(1), y1: bsy.toFixed(1), x2: bex.toFixed(1), y2: bey.toFixed(1), stroke: col, 'stroke-width': Math.max(1, trW * .5) }));
    }
    return g;
  }

  function dBush(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc, bs = 1.8 * sc * df;
    const col = applyLit(e.hue, e.sat, e.lit, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    for (let i = 0; i < Math.min(3, e.blobO.length); i++) {
      const [ox, oy, or] = e.blobO[i];
      const bx = (sx + ox * bs * .52).toFixed(1), by = (base - oy * bs * .5).toFixed(1);
      const rx = (or * bs * .68).toFixed(1), ry = (or * bs * .52).toFixed(1);
      g.append(getPooled('ellipse', { cx: bx, cy: by, rx, ry, fill: col }));
    }
    return g;
  }

  function dFern(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const flen = 2.4 * sc * df, n = Math.min(4, e.fronds), spread = e.spread;
    const col = applyLit(e.hue, e.sat, e.lit, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    for (let i = 0; i < n; i++) {
      const a = ((i / (n - 1)) * 2 - 1) * Math.PI * spread - Math.PI / 2;
      const ex = (sx + Math.cos(a) * flen).toFixed(1), ey = (base + Math.sin(a) * flen).toFixed(1);
      const mx = (sx + Math.cos(a) * .55 * flen).toFixed(1), my = (base + Math.sin(a) * .55 * flen).toFixed(1);
      g.append(getPooled('path', { d: 'M' + sx + ',' + base + ' Q' + mx + ',' + my + ' ' + ex + ',' + ey, stroke: col, 'stroke-width': Math.max(.8, flen * .09), fill: 'none' }));
    }
    return g;
  }

  function dGrass(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const blen = 2.2 * sc * df, n = Math.min(3, e.blades), spread = 1.6 * sc * df;
    const col = applyLit(e.hue, e.sat, e.lit, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    for (let i = 0; i < n; i++) {
      const bx = sx + (i / (n - 1) - .5) * spread;
      const tx = (bx + e.sway * blen).toFixed(1);
      g.append(getPooled('path', { d: 'M' + bx.toFixed(1) + ',' + base + ' L' + tx + ',' + (base - blen).toFixed(1), stroke: col, 'stroke-width': '1.2', fill: 'none' }));
    }
    return g;
  }

  function dFlower(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const sH = e.stemH * sc * df, pr = Math.max(2, sH * .32);
    const pCol = 'hsl(' + e.pHue + ',' + e.pSat + '%,' + clamp(e.pLit * (.12 + sky.amb * .88), 4, 88) + '%)';
    const sCol = applyLit(112, 52, 20, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('line', { x1: sx.toFixed(1), y1: base.toFixed(1), x2: sx.toFixed(1), y2: (base - sH).toFixed(1), stroke: sCol, 'stroke-width': '1.5' }));
    g.append(getPooled('circle', { cx: sx.toFixed(1), cy: (base - sH).toFixed(1), r: pr.toFixed(1), fill: pCol }));
    return g;
  }

  function dMushroom(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const sH = 1.5 * sc * df, cR = 1.7 * sc * df;
    const cCol = 'hsl(' + e.cHue + ',' + e.cSat + '%,' + clamp(e.cLit * (.10 + sky.amb * .90), 3, 82) + '%)';
    const sCol = applyLit(30, 14, 60, sky);
    const cy = (base - sH).toFixed(1);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('rect', { x: (sx - cR * 0.2).toFixed(1), y: cy, width: (cR * 0.4).toFixed(1), height: sH.toFixed(1), fill: sCol }));
    g.append(getPooled('ellipse', { cx: sx.toFixed(1), cy, rx: cR.toFixed(1), ry: (cR * .65).toFixed(1), fill: cCol }));
    return g;
  }

  function dRock(e, p, sky) {
    const { sx, sy: base, df } = p, sc = e.sc;
    const rx = sc * df * 1.65, ry = rx * e.flat;
    const col = applyLit(20, 8, e.grey, sky);
    const g = getPooled('g', { opacity: fogA(p.cz).toFixed(3) });
    g.append(getPooled('ellipse', { cx: sx.toFixed(1), cy: (base - ry * 0.4).toFixed(1), rx: rx.toFixed(1), ry: ry.toFixed(1), fill: col }));
    return g;
  }

  function drawEnt(e, pr, sky) {
    switch (e.type) {
      case 'TALL_TREE':  return dTallTree(e, pr, sky);
      case 'ROUND_TREE': return dRoundTree(e, pr, sky);
      case 'PINE':       return dPine(e, pr, sky);
      case 'OAK':        return dOak(e, pr, sky);
      case 'DEAD_TREE':  return dDeadTree(e, pr, sky);
      case 'BUSH':       return dBush(e, pr, sky);
      case 'FERN':       return dFern(e, pr, sky);
      case 'TALL_GRASS': return dGrass(e, pr, sky);
      case 'FLOWER':     return dFlower(e, pr, sky);
      case 'MUSHROOM':   return dMushroom(e, pr, sky);
      case 'ROCK':       return dRock(e, pr, sky);
    }
    return null;
  }

  function drawLeaves(sky) {
    const particles = Leaves.getParticles();
    const h = innerHeight;
    for (const p of particles) {
      const pr = proj(p.x, p.y, p.z, 0, 0, 0, 0);
      if (!pr) continue;
      const leafW = Math.max(2, p.sz * pr.ps * h * 0.18);
      const col = applyLit(p.hue, p.sat, p.lit, sky);
      const leafPath = getPooled('path', {
        d: `M ${pr.sx.toFixed(1)} ${(pr.sy - leafW).toFixed(1)} L ${(pr.sx + leafW).toFixed(1)} ${pr.sy.toFixed(1)} L ${pr.sx.toFixed(1)} ${(pr.sy + leafW).toFixed(1)} L ${(pr.sx - leafW).toFixed(1)} ${pr.sy.toFixed(1)} Z`,
        fill: col,
        opacity: Math.min(0.85, fogA(pr.cz)).toFixed(2)
      });
      leafG.append(leafPath);
    }
  }

  function updateSky(sky, playerPos) {
    ss0.setAttribute('stop-color', sky.top);
    ss1.setAttribute('stop-color', sky.mid);
    ss2.setAttribute('stop-color', sky.bot);

    const userGnd = World.getGroundColor(playerPos.x, playerPos.z);
    const gndTop = applyLit(userGnd.hue, userGnd.sat * 0.8, userGnd.lit * 0.85, sky);
    const gndBot = applyLit(userGnd.hue, userGnd.sat * 0.9, userGnd.lit * 1.15, sky);
    gs0.setAttribute('stop-color', gndTop);
    gs1.setAttribute('stop-color', gndBot);

    mistR.setAttribute('fill', sky.fog);
    mistR.setAttribute('opacity', (sky.amb * .14 + .04).toFixed(3));
    starsG.setAttribute('opacity', sky.star.toFixed(3));

    const w = innerWidth, h = innerHeight;
    const sT = clamp((sky.t - 0.22) / (0.78 - 0.22), 0, 1);
    const sX = w * sT, sY = h * (0.48 - Math.sin(sT * Math.PI) * 0.40);
    [sunEl, sunGlow].forEach(el => { el.setAttribute('cx', sX.toFixed(0)); el.setAttribute('cy', sY.toFixed(0)); });
    sunEl.setAttribute('opacity', sky.sun.toFixed(3));
    sunGlow.setAttribute('opacity', sky.sun.toFixed(3));

    const mT = clamp((((sky.t + 0.5) % 1) - 0.22) / (0.78 - 0.22), 0, 1);
    const mX = w * mT, mY = h * (0.48 - Math.sin(mT * Math.PI) * 0.40);
    moonEl.setAttribute('cx', mX.toFixed(0)); moonEl.setAttribute('cy', mY.toFixed(0));
    moonEl.setAttribute('opacity', sky.moon.toFixed(3));
  }

  // ── Optimized Render Loop (Zero DOM allocation per frame) ───────────────
  function render(player, worldData, sky, transitionState = 'FOREST', transitionProgress = 0.0) {
    resetPool();
    updateSky(sky, player);

    let shakeX = 0, shakeY = 0;
    if (transitionState === 'EARTHQUAKE' || transitionState === 'TRANSITION') {
      shakeX = (Math.random() - 0.5) * 22;
      shakeY = (Math.random() - 0.5) * 18;
    }

    const py = World.getHeight(player.x, player.z) + EYE_H + (player.bobY || 0);
    const sceneItems = [];

    // 1. Terrain tiles
    for (let i = 0; i < worldData.tiles.length; i++) {
      const res = drawTerrainTile(worldData.tiles[i], player, py, sky, shakeX, shakeY);
      if (res) sceneItems.push({ poly: res.poly, cz: res.cz });
    }

    // 2. Forest entities
    const sinkAmount = (transitionState === 'TRANSITION' || transitionState === 'EARTHQUAKE') ? transitionProgress * 18.0 : 0.0;
    for (let i = 0; i < worldData.ents.length; i++) {
      const e = worldData.ents[i];
      const effectiveWy = e.wy - sinkAmount;
      const p = proj(e.x, effectiveWy, e.z, player.x, py, player.z, player.angle, player.bobX || 0, shakeX, shakeY);
      if (p) {
        const el = drawEnt(e, p, sky);
        if (el) sceneItems.push({ poly: el, cz: p.cz });
      }
    }

    // 3. Buildings
    if ((transitionState === 'TRANSITION' || transitionState === 'EARTHQUAKE' || transitionState === 'CITY') && worldData.buildings) {
      const riseFactor = Math.min(1.0, Math.max(0.0, transitionProgress * 1.25));
      for (let i = 0; i < worldData.buildings.length; i++) {
        const b = worldData.buildings[i];
        const p = proj(b.x, b.wy, b.z, player.x, py, player.z, player.angle, player.bobX || 0, shakeX, shakeY);
        if (p) {
          const el = dBuilding(b, p, sky, riseFactor);
          if (el) sceneItems.push({ poly: el, cz: p.cz });
        }
      }
    }

    // 4. Sort depth and append pooled elements in order
    sceneItems.sort((a, b) => b.cz - a.cz);
    for (let i = 0; i < sceneItems.length; i++) {
      sceneG.append(sceneItems[i].poly);
    }

    drawLeaves(sky);
    hideUnusedPooled();
  }

  return { render };
})();
