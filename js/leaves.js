'use strict';
const Leaves = (() => {
  const COUNT = 8;
  const particles = [];

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 30,
      y: 1.5 + Math.random() * 4.0,
      z: 3.0 + Math.random() * 20,
      sz: 0.12 + Math.random() * 0.15,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2.0,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -0.4 - Math.random() * 0.4,
      vz: -0.4 - Math.random() * 0.6,
      hue: 30 + Math.random() * 40,
      sat: 65 + Math.random() * 25,
      lit: 35 + Math.random() * 20,
    });
  }

  function update(dt, px, pz, ang) {
    const windSpeed = 1.0;
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      p.x += (p.vx + Math.sin(p.rot) * 0.3) * dt * windSpeed;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.vRot * dt;

      if (p.y < 0.1 || p.z < 1.0) {
        p.x = px + (Math.random() - 0.5) * 25;
        p.y = 2.0 + Math.random() * 5.0;
        p.z = pz + 4.0 + Math.random() * 16.0;
        p.rot = Math.random() * Math.PI * 2;
      }
    }
  }

  function getParticles() {
    return particles;
  }

  return { update, getParticles };
})();
