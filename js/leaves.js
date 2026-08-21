'use strict';
const Leaves = (() => {
  const COUNT = 16;
  const particles = [];

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 40,
      y: 1.5 + Math.random() * 5.0,
      z: 2.0 + Math.random() * 25,
      sz: 0.12 + Math.random() * 0.18,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2.5,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.4 - Math.random() * 0.6,
      vz: -0.5 - Math.random() * 0.8,
      hue: 25 + Math.random() * 45,
      sat: 65 + Math.random() * 30,
      lit: 35 + Math.random() * 25,
    });
  }

  function update(dt, px, pz, ang) {
    const windSpeed = 1.2;
    const sin = Math.sin(ang), cos = Math.cos(ang);

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      p.x += (p.vx + Math.sin(p.rot) * 0.4) * dt * windSpeed;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.vRot * dt;

      if (p.y < 0.1 || p.z < 1.0) {
        p.x = px + (Math.random() - 0.5) * 35;
        p.y = 2.0 + Math.random() * 6.0;
        p.z = pz + 5.0 + Math.random() * 20.0;
        p.rot = Math.random() * Math.PI * 2;
      }
    }
  }

  function getParticles() {
    return particles;
  }

  return { update, getParticles };
})();
