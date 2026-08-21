'use strict';
const Leaves = (() => {
  const NUM_LEAVES = 38;
  const particles = [];

  function init() {
    for (let i = 0; i < NUM_LEAVES; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 45,
        y: Math.random() * 8 + 1.0,
        z: Math.random() * 50 + 2.0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        sz: 0.22 + Math.random() * 0.28,
        // Autumn leaf palette: orange, golden yellow, red, brown
        hue: [22, 38, 48, 12, 350][Math.floor(Math.random() * 5)],
        sat: 65 + Math.random() * 30,
        lit: 35 + Math.random() * 25,
      });
    }
  }
  init();

  let time = 0;
  function update(dt, px, pz, ang) {
    time += dt;
    // Dynamic gusting wind vector
    const windX = Math.sin(time * 0.6) * 1.8 + 1.2;
    const windZ = Math.cos(time * 0.4) * 1.0 - 0.5;
    const windY = Math.sin(time * 1.4) * 0.4 - 0.3;

    for (const p of particles) {
      p.x += windX * dt;
      p.y += windY * dt;
      p.z += windZ * dt;
      p.rot += p.rotSpeed;

      // Wrap around camera box
      if (p.x > 30) p.x -= 60;
      if (p.x < -30) p.x += 60;
      if (p.z > 55) p.z -= 52;
      if (p.z < 1.0) p.z += 52;
      if (p.y < 0.2) p.y += 9.0;
      if (p.y > 10.0) p.y -= 9.0;
    }
  }

  function getParticles() { return particles; }

  return { update, getParticles };
})();
