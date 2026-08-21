'use strict';
const Sky = (() => {
  // Keyframes over t in [0,1]:
  // Dawn=0.20, Morning=0.30, Noon=0.50, Afternoon=0.65,
  // Evening=0.76, Dusk=0.85, Night=0.95
  const KF = [
    { t:0.00, top:'#010205', mid:'#020510', bot:'#030710', fog:'#020406', gnd:'#030403', amb:0.06, sun:0.00, moon:0.90, star:1.00 },
    { t:0.17, top:'#030210', mid:'#200828', bot:'#601015', fog:'#400a10', gnd:'#0a0604', amb:0.15, sun:0.10, moon:0.55, star:0.55 },
    { t:0.26, top:'#102060', mid:'#c03518', bot:'#e86018', fog:'#c05020', gnd:'#160c06', amb:0.42, sun:0.72, moon:0.00, star:0.00 },
    { t:0.36, top:'#1845a8', mid:'#5090d8', bot:'#f0bc55', fog:'#c8a060', gnd:'#1a2808', amb:0.82, sun:0.96, moon:0.00, star:0.00 },
    { t:0.50, top:'#0848c8', mid:'#2888e8', bot:'#55c0f8', fog:'#88c4f8', gnd:'#182808', amb:1.00, sun:1.00, moon:0.00, star:0.00 },
    { t:0.65, top:'#0840b8', mid:'#2870cc', bot:'#60b0f0', fog:'#80b0e8', gnd:'#142208', amb:0.95, sun:0.98, moon:0.00, star:0.00 },
    { t:0.76, top:'#100528', mid:'#982215', bot:'#e85c18', fog:'#d07838', gnd:'#160a04', amb:0.48, sun:0.72, moon:0.00, star:0.00 },
    { t:0.85, top:'#05020c', mid:'#180620', bot:'#3a0e14', fog:'#180610', gnd:'#080506', amb:0.18, sun:0.00, moon:0.42, star:0.55 },
    { t:0.95, top:'#010205', mid:'#020510', bot:'#030710', fog:'#020406', gnd:'#030403', amb:0.06, sun:0.00, moon:0.88, star:1.00 },
    { t:1.00, top:'#010205', mid:'#020510', bot:'#030710', fog:'#020406', gnd:'#030403', amb:0.06, sun:0.00, moon:0.90, star:1.00 },
  ];

  function ph(h) {
    h = h.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function lc(c1, c2, t) {
    const a=ph(c1), b=ph(c2);
    return 'rgb('+((lerp(a[0],b[0],t))|0)+','+((lerp(a[1],b[1],t))|0)+','+((lerp(a[2],b[2],t))|0)+')';
  }

  const STARS = [];
  { let s=987654321;
    const rng=()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/0xffffffff; };
    for(let i=0;i<280;i++) STARS.push({x:rng()*100,y:rng()*52,r:0.35+rng()*1.45,b:0.3+rng()*0.7});
  }

  function getState(t) {
    t=((t%1)+1)%1;
    let f0=KF[KF.length-2], f1=KF[KF.length-1];
    for(let i=0;i<KF.length-1;i++){
      if(KF[i].t<=t&&KF[i+1].t>t){ f0=KF[i]; f1=KF[i+1]; break; }
    }
    const k=(t-f0.t)/(f1.t-f0.t);
    return {
      top:  lc(f0.top, f1.top, k),
      mid:  lc(f0.mid, f1.mid, k),
      bot:  lc(f0.bot, f1.bot, k),
      fog:  lc(f0.fog, f1.fog, k),
      gnd:  lc(f0.gnd, f1.gnd, k),
      amb:  lerp(f0.amb, f1.amb, k),
      sun:  lerp(f0.sun, f1.sun, k),
      moon: lerp(f0.moon, f1.moon, k),
      star: lerp(f0.star, f1.star, k),
      t,
    };
  }

  return { getState, STARS };
})();
