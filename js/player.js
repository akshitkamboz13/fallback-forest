'use strict';
const Player = (() => {
  const state = {
    x: 0,
    z: 0,
    angle: 0,
    bobTimer: 0,
    bobY: 0,      // Vertical head bob (up/down step)
    bobX: 0,      // Horizontal body sway (left/right step weight)
    isWalking: false,
  };
  const keys = {};
  let lastStepPhase = 0;

  addEventListener('keydown', e => {
    keys[e.code] = true;
    AudioEngine.resume();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD'].includes(e.code)) {
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  let touchX = null;
  addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
    AudioEngine.resume();
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (touchX === null) return;
    state.angle += (e.touches[0].clientX - touchX) * 0.005;
    touchX = e.touches[0].clientX;
  }, { passive: true });
  addEventListener('touchend', () => { touchX = null; });

  function update(near) {
    const sa = Math.sin(state.angle), ca = Math.cos(state.angle);
    let nx = state.x, nz = state.z;
    let moving = false;

    if (keys['ArrowUp'] || keys['KeyW']) { nx += sa * CFG.MOVE_SPEED; nz += ca * CFG.MOVE_SPEED; moving = true; }
    if (keys['ArrowDown'] || keys['KeyS']) { nx -= sa * CFG.MOVE_SPEED; nz -= ca * CFG.MOVE_SPEED; moving = true; }
    if (keys['ArrowLeft'] || keys['KeyA']) state.angle -= CFG.TURN_SPEED;
    if (keys['ArrowRight'] || keys['KeyD']) state.angle += CFG.TURN_SPEED;

    // Collision check
    let blocked = false;
    for (const e of near) {
      const dx = nx - e.x, dz = nz - e.z;
      const r = CFG.COLLIDE_R + e.colR * (e.sc || 1) * 0.20;
      if (dx * dx + dz * dz < r * r) { blocked = true; break; }
    }
    if (!blocked && moving) {
      state.x = nx;
      state.z = nz;
    }

    state.isWalking = moving;

    // Human Walking Motion: Head Bob & Body Sway
    if (moving && !blocked) {
      state.bobTimer += 0.16; // Step speed
      // Rhythmic vertical head bob (2 steps per stride cycle)
      state.bobY = Math.abs(Math.sin(state.bobTimer)) * 0.18;
      // Rhythmic horizontal side-to-side sway (left foot vs right foot)
      state.bobX = Math.sin(state.bobTimer * 0.5) * 0.09;

      // Trigger footstep sound at bottom of each step cycle
      const phase = Math.sin(state.bobTimer);
      if (lastStepPhase < 0.1 && phase >= 0.1) {
        AudioEngine.playFootstep();
      }
      lastStepPhase = phase;
    } else {
      // Smooth decay back to rest position when standing still
      state.bobY *= 0.82;
      state.bobX *= 0.82;
      state.bobTimer = 0;
      lastStepPhase = 0;
    }
  }

  return { state, update };
})();
