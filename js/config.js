'use strict';
const CFG = Object.freeze({
  CHUNK_SIZE:   16,
  LOAD_RADIUS:   5,
  PRUNE_RADIUS:  7,
  FAR:           82,
  NEAR:          0.4,
  FOV:           1.48,          // ~85 degrees
  MOVE_SPEED:    0.15,
  TURN_SPEED:    0.038,
  COLLIDE_R:     0.25,
  DAY_DURATION:  200,           // seconds per full day
});
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
