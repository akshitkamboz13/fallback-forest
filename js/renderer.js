'use strict';
const Renderer = (() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const EYE_H  = 1.65;
  const VSCALE = 0.24;

  let width = innerWidth, height = innerHeight;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    canvas.width = width;
    canvas.height = height;
  }
  addEventListener('resize', resize);
  resize();

  // ── Projection Math ──────────────────────────────────────────────────────
  function proj(wx, wy, wz, px, py, pz, ang, bobX = 0, shakeX = 0, shakeY = 0) {
    const effX = px + Math.cos(ang) * bobX;
    const effZ = pz - Math.sin(ang) * bobX;
    const dx = wx - effX, dy = wy - py, dz = wz - effZ;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = dx * ca - dz * sa;
    const cz = dx * sa + dz * ca;
    if (cz < CFG.NEAR || cz > CFG.FAR) return null;

    const fp = 1 / Math.atan(CFG.FOV / 2);
    const sx = width * (0.5 + 0.5 * (cx / cz) * fp) + shakeX;
    const ps = fp / cz;
    const df = ps * height * VSCALE;
    const sy = height * 0.5 - (dy / cz) * fp * height * VSCALE + shakeY;
    return { sx, sy, cz, ps, df, w: width, h: height };
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
    const sx = width * (0.5 + 0.5 * (cx / safeZ) * fp) + shakeX;
    const sy = height * 0.5 - (dy / safeZ) * fp * height * VSCALE + shakeY;
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

  // ── Render Terrain Tile ──────────────────────────────────────────────────
  function drawTerrainTile(tile, player, py, sky, shakeX = 0, shakeY = 0) {
    const bX = player.bobX || 0;
    const p0 = projTerrainCorner(tile.p0.x, tile.p0.y, tile.p0.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p1 = projTerrainCorner(tile.p1.x, tile.p1.y, tile.p1.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p2 = projTerrainCorner(tile.p2.x, tile.p2.y, tile.p2.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);
    const p3 = projTerrainCorner(tile.p3.x, tile.p3.y, tile.p3.z, player.x, py, player.z, player.angle, bX, shakeX, shakeY);

    if (p0.cz < 0.05 && p1.cz < 0.05 && p2.cz < 0.05 && p3.cz < 0.05) return null;
    if (p0.cz > CFG.FAR && p1.cz > CFG.FAR && p2.cz > CFG.FAR && p3.cz > CFG.FAR) return null;

    const avgCz = (Math.max(0.1, p0.cz) + Math.max(0.1, p1.cz) + Math.max(0.1, p2.cz) + Math.max(0.1, p3.cz)) * 0.25;
    const baseCol = applyLit(tile.color.hue, tile.color.sat, tile.color.lit, sky);

    return {
      cz: avgCz,
      render: () => {
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.closePath();
        ctx.fill();
      }
    };
  }

  // ── Render City Building ─────────────────────────────────────────────────
  function drawBuilding(b, p, sky, riseProgress = 1.0) {
    const { sx, sy: base, df } = p;
    const bW = b.w * df, bH = b.h * df * riseProgress;
    if (bH <= 1) return null;

    const col = applyLit(b.hue, b.sat, b.lit, sky);
    const sideCol = applyDark(b.hue, b.sat, b.lit, sky);
    const winCol = 'hsl(45, 95%, ' + Math.floor(60 + sky.amb * 30) + '%)';
    const topY = base - bH;
    const dW = bW * 0.25;

    return {
      cz: p.cz,
      render: () => {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, riseProgress * 1.2);

        // Facade
        ctx.fillStyle = col;
        ctx.strokeStyle = '#080c14';
        ctx.lineWidth = 1;
        ctx.fillRect(sx - bW * 0.5, topY, bW, bH);
        ctx.strokeRect(sx - bW * 0.5, topY, bW, bH);

        // Side 3D
        ctx.fillStyle = sideCol;
        ctx.beginPath();
        ctx.moveTo(sx + bW * 0.5, base);
        ctx.lineTo(sx + bW * 0.5 + dW, base - dW * 0.5);
        ctx.lineTo(sx + bW * 0.5 + dW, topY - dW * 0.5);
        ctx.lineTo(sx + bW * 0.5, topY);
        ctx.closePath();
        ctx.fill();

        // Windows
        const rows = Math.min(4, b.windowRows), cols = Math.min(3, b.windowCols);
        const wW = bW * 0.16, wH = bH / (rows * 1.8);
        ctx.fillStyle = winCol;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const wx = sx - bW * 0.38 + c * (bW * 0.24);
            const wy = topY + bH * 0.10 + r * (bH * 0.80 / rows);
            ctx.globalAlpha = (0.55 + ((r + c) % 3) * 0.20) * riseProgress;
            ctx.fillRect(wx, wy, wW, wH);
          }
        }

        // Antenna
        if (b.roofAntenna) {
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, topY);
          ctx.lineTo(sx, topY - bW * 0.6);
          ctx.stroke();

          ctx.fillStyle = '#ff3333';
          ctx.beginPath();
          ctx.arc(sx, topY - bW * 0.6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };
  }

  // ── Render Trees & Entities ──────────────────────────────────────────────
  function drawEnt(e, p, sky) {
    const { sx, sy: base, df } = p;
    const sc = e.sc;
    const alpha = fogA(p.cz);
    if (alpha <= 0.01) return null;

    const col = applyLit(e.hue, e.sat, e.lit, sky);
    const drk = applyDark(e.hue, e.sat, e.lit, sky);
    const trC = applyLit(25, 42, 11, sky);

    return {
      cz: p.cz,
      render: () => {
        ctx.save();
        ctx.globalAlpha = alpha;

        switch (e.type) {
          case 'TALL_TREE':
          case 'ROUND_TREE': {
            const trH = e.trH * sc * df, caH = e.caH * sc * df, caW = e.caW * sc * df;
            const trW = Math.max(2, caW * .16), lean = e.lean || 0;
            const lx = sx + lean * trH;

            // Trunk
            ctx.fillStyle = trC;
            ctx.beginPath();
            ctx.moveTo(sx - trW / 2, base);
            ctx.lineTo(sx + trW / 2, base);
            ctx.lineTo(lx + trW / 2, base - trH);
            ctx.lineTo(lx - trW / 2, base - trH);
            ctx.closePath();
            ctx.fill();

            // Foliage
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(lx, base - trH - caH * 0.35, caW * 0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = drk;
            ctx.beginPath();
            ctx.arc(lx + caW * 0.15, base - trH - caH * 0.30, caW * 0.45, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'PINE': {
            const trH = e.trH * sc * df, trW = Math.max(2, 2.8 * sc * df * .12);
            ctx.fillStyle = trC;
            ctx.fillRect(sx - trW / 2, base - trH, trW, trH);

            const n = Math.min(3, e.layers);
            const lH = 3.2 * sc * df / n;
            for (let i = 0; i < n; i++) {
              const t = i / n, w = (2.8 * sc * df) * (1 - t * .52);
              const layBase = base - trH - i * lH * .68, tip = layBase - lH * 1.2;
              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.moveTo(sx - w, layBase);
              ctx.lineTo(sx + w, layBase);
              ctx.lineTo(sx, tip);
              ctx.closePath();
              ctx.fill();
            }
            break;
          }

          case 'OAK': {
            const trH = e.trH * sc * df, trW = Math.max(3, 4 * sc * df * .13);
            ctx.fillStyle = trC;
            ctx.fillRect(sx - trW / 2, base - trH, trW, trH);

            const bs = 2.2 * sc * df;
            ctx.fillStyle = col;
            for (let i = 0; i < Math.min(3, e.blobO.length); i++) {
              const [ox, oy, or] = e.blobO[i];
              ctx.beginPath();
              ctx.ellipse(sx + ox * bs * .52, base - trH - oy * bs * .62, or * bs * .72, or * bs * .58, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }

          case 'BUSH': {
            const bs = 1.8 * sc * df;
            ctx.fillStyle = col;
            for (let i = 0; i < Math.min(3, e.blobO.length); i++) {
              const [ox, oy, or] = e.blobO[i];
              ctx.beginPath();
              ctx.ellipse(sx + ox * bs * .52, base - oy * bs * .5, or * bs * .68, or * bs * .52, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }

          case 'FERN':
          case 'TALL_GRASS': {
            const blen = 2.2 * sc * df;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx, base);
            ctx.lineTo(sx + (e.sway || 0) * blen, base - blen);
            ctx.stroke();
            break;
          }

          case 'FLOWER': {
            const sH = e.stemH * sc * df, pr = Math.max(2, sH * .32);
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(sx, base);
            ctx.lineTo(sx, base - sH);
            ctx.stroke();

            ctx.fillStyle = 'hsl(' + e.pHue + ',' + e.pSat + '%, 60%)';
            ctx.beginPath();
            ctx.arc(sx, base - sH, pr, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'MUSHROOM': {
            const sH = 1.5 * sc * df, cR = 1.7 * sc * df;
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(sx - cR * 0.2, base - sH, cR * 0.4, sH);

            ctx.fillStyle = 'hsl(' + e.cHue + ',' + e.cSat + '%, 50%)';
            ctx.beginPath();
            ctx.ellipse(sx, base - sH, cR, cR * 0.65, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'ROCK': {
            const rx = sc * df * 1.65, ry = rx * e.flat;
            ctx.fillStyle = applyLit(20, 8, e.grey, sky);
            ctx.beginPath();
            ctx.ellipse(sx, base - ry * 0.4, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }

        ctx.restore();
      }
    };
  }

  // ── Render Sky Background & Stars ────────────────────────────────────────
  function drawSky(sky) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.5);
    skyGrad.addColorStop(0, sky.top);
    skyGrad.addColorStop(0.55, sky.mid);
    skyGrad.addColorStop(1, sky.bot);

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.5);

    // Stars
    if (sky.star > 0.05) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < Sky.STARS.length; i++) {
        const s = Sky.STARS[i];
        ctx.globalAlpha = s.b * sky.star;
        ctx.beginPath();
        ctx.arc((s.x / 100) * width, (s.y / 100) * (height * 0.5), s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Sun & Moon
    const sT = clamp((sky.t - 0.22) / (0.78 - 0.22), 0, 1);
    const sX = width * sT, sY = height * (0.48 - Math.sin(sT * Math.PI) * 0.40);
    if (sky.sun > 0.02) {
      ctx.save();
      ctx.globalAlpha = sky.sun;
      ctx.fillStyle = 'rgba(255,238,110,0.18)';
      ctx.beginPath(); ctx.arc(sX, sY, 52, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath(); ctx.arc(sX, sY, 21, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Ground Gradient
    const gndGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    const userGnd = World.getGroundColor(0, 0);
    gndGrad.addColorStop(0, applyLit(userGnd.hue, userGnd.sat * 0.8, userGnd.lit * 0.85, sky));
    gndGrad.addColorStop(1, applyLit(userGnd.hue, userGnd.sat * 0.9, userGnd.lit * 1.15, sky));

    ctx.fillStyle = gndGrad;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);
  }

  // ── Render Leaves ────────────────────────────────────────────────────────
  function drawLeaves(sky) {
    const particles = Leaves.getParticles();
    ctx.save();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const pr = proj(p.x, p.y, p.z, 0, 0, 0, 0);
      if (!pr) continue;

      const leafW = Math.max(2, p.sz * pr.ps * height * 0.18);
      ctx.fillStyle = applyLit(p.hue, p.sat, p.lit, sky);
      ctx.globalAlpha = Math.min(0.85, fogA(pr.cz));
      ctx.fillRect(pr.sx, pr.sy, leafW, leafW);
    }
    ctx.restore();
  }

  // ── Main Render Frame ────────────────────────────────────────────────────
  function render(player, worldData, sky, transitionState = 'FOREST', transitionProgress = 0.0) {
    ctx.clearRect(0, 0, width, height);
    drawSky(sky);

    let shakeX = 0, shakeY = 0;
    if (transitionState === 'EARTHQUAKE' || transitionState === 'TRANSITION') {
      shakeX = (Math.random() - 0.5) * 22;
      shakeY = (Math.random() - 0.5) * 18;
    }

    const py = World.getHeight(player.x, player.z) + EYE_H + (player.bobY || 0);
    const sceneItems = [];

    // 1. Tiles
    for (let i = 0; i < worldData.tiles.length; i++) {
      const res = drawTerrainTile(worldData.tiles[i], player, py, sky, shakeX, shakeY);
      if (res) sceneItems.push(res);
    }

    // 2. Entities
    const sinkAmount = (transitionState === 'TRANSITION' || transitionState === 'EARTHQUAKE') ? transitionProgress * 18.0 : 0.0;
    for (let i = 0; i < worldData.ents.length; i++) {
      const e = worldData.ents[i];
      const effectiveWy = e.wy - sinkAmount;
      const p = proj(e.x, effectiveWy, e.z, player.x, py, player.z, player.angle, player.bobX || 0, shakeX, shakeY);
      if (p) {
        const el = drawEnt(e, p, sky);
        if (el) sceneItems.push(el);
      }
    }

    // 3. Buildings
    if ((transitionState === 'TRANSITION' || transitionState === 'EARTHQUAKE' || transitionState === 'CITY') && worldData.buildings) {
      const riseFactor = Math.min(1.0, Math.max(0.0, transitionProgress * 1.25));
      for (let i = 0; i < worldData.buildings.length; i++) {
        const b = worldData.buildings[i];
        const p = proj(b.x, b.wy, b.z, player.x, py, player.z, player.angle, player.bobX || 0, shakeX, shakeY);
        if (p) {
          const el = drawBuilding(b, p, sky, riseFactor);
          if (el) sceneItems.push(el);
        }
      }
    }

    // 4. Back-to-front depth sorting & GPU draw calls
    sceneItems.sort((a, b) => b.cz - a.cz);
    for (let i = 0; i < sceneItems.length; i++) {
      sceneItems[i].render();
    }

    // 5. Leaf particles
    drawLeaves(sky);
  }

  return { render };
})();
