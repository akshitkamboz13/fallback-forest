'use strict';
window._speechUtterances = [];

const AudioEngine = (() => {
  let ctx = null;
  let isInit = false;
  let bgWindGain = null;
  let cachedVoice = null;

  function init() {
    if (isInit) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      isInit = true;
      setupAmbientLoop();
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  function unlockAudio() {
    init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      speak("Server unreachable. I'm currently somewhere deep in the forest. Apparently I need internet to buy Starlink. Walking toward the city... help me to find the city!");
    }
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoice = voices.find(v => v.lang && (v.lang.startsWith('en') || v.lang.includes('US') || v.lang.includes('GB'))) || voices[0];
    }
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  function setupAmbientLoop() {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5) * 0.05;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const bgWindFilter = ctx.createBiquadFilter();
    bgWindFilter.type = 'bandpass';
    bgWindFilter.frequency.setValueAtTime(320, ctx.currentTime);
    bgWindFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(bgWindFilter.frequency);
    lfo.start();

    bgWindGain = ctx.createGain();
    bgWindGain.gain.setValueAtTime(0.12, ctx.currentTime);

    whiteNoise.connect(bgWindFilter);
    bgWindFilter.connect(bgWindGain);
    bgWindGain.connect(ctx.destination);

    whiteNoise.start();
  }

  function playEarthquakeSound(duration = 3.0) {
    resume();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(38, now);
    osc.frequency.linearRampToValueAtTime(65, now + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(25, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.4);
    gain.gain.linearRampToValueAtTime(0.30, now + duration - 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  function playFootstep() {
    resume();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 0.075);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900 + Math.random() * 350, now);
    filter.Q.value = 2.2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.055);

    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function playVocalChatter(text) {
    if (!ctx || ctx.state !== 'running') return;
    const words = text.split(' ').slice(0, 6);
    words.forEach((w, idx) => {
      const now = ctx.currentTime + idx * 0.10;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 135 + (w.charCodeAt(0) % 75);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.07);

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
    });
  }

  function speak(text) {
    resume();
    playVocalChatter(text);

    if (!('speechSynthesis' in window)) return;

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 0.95;
      utt.volume = 1.0;

      if (!cachedVoice) loadVoices();
      if (cachedVoice) utt.voice = cachedVoice;

      window._speechUtterances.push(utt);
      utt.onend = () => {
        const idx = window._speechUtterances.indexOf(utt);
        if (idx > -1) window._speechUtterances.splice(idx, 1);
      };
      utt.onerror = () => {
        const idx = window._speechUtterances.indexOf(utt);
        if (idx > -1) window._speechUtterances.splice(idx, 1);
      };

      window.speechSynthesis.speak(utt);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  }

  ['click', 'keydown', 'touchstart'].forEach(evt => {
    addEventListener(evt, () => resume(), { once: false, passive: true });
  });

  return { init, unlockAudio, resume, playFootstep, playEarthquakeSound, speak };
})();
