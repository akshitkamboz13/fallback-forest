'use strict';
const CFG = Object.freeze({
  CHUNK_SIZE:   16,
  LOAD_RADIUS:   3,             // Optimized 7x7 grid (cuts render load by 60%)
  PRUNE_RADIUS:  4,             // Aggressive chunk memory cleanup
  FAR:           64,            // View distance cutoff
  NEAR:          0.3,
  FOV:           1.48,          // ~85 degrees
  MOVE_SPEED:    0.15,
  TURN_SPEED:    0.038,
  COLLIDE_R:     0.25,
  DAY_DURATION:  200,           // seconds per full day
});
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
