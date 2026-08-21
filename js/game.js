'use strict';
(function(){
  let dayTime = 0.36; // Start morning
  let lastTs = 0;

  // Transition States: 'FOREST' | 'EARTHQUAKE' | 'TRANSITION' | 'CITY'
  let transitionState = 'FOREST';
  let transitionProgress = 0.0; // 0.0 to 1.0
  let citySpoken = false;

  // Initialize dialogue system
  DialogueSystem.init();

  // Initialize Server Health & Cloudflare Worker Listener
  ServerHealth.init(() => {
    triggerServerRestoredSequence();
  });

  function triggerServerRestoredSequence() {
    if (transitionState !== 'FOREST') return;
    transitionState = 'EARTHQUAKE';

    // 1. Play deep earthquake low-frequency rumble sound
    if (typeof AudioEngine !== 'undefined' && AudioEngine.playEarthquakeSound) {
      AudioEngine.playEarthquakeSound(4.5);
    }

    // 2. Initial earthquake rumble message
    const msg = "⚡ SIGNAL DETECTED! Ground is shaking... Stand by!";
    const textEl = document.getElementById('dialogue-text');
    const hudEl = document.getElementById('dialogue-hud');
    if (textEl && hudEl) {
      textEl.textContent = msg;
      hudEl.classList.add('active');
    }
  }

  function speakCityConnected() {
    if (citySpoken) return;
    citySpoken = true;

    // Exact user requested monologue
    const cityMsg = "You found the city and network! Server is now connected!";
    const textEl = document.getElementById('dialogue-text');
    const hudEl = document.getElementById('dialogue-hud');

    if (textEl && hudEl) {
      textEl.textContent = cityMsg;
      hudEl.classList.add('active');
    }

    // Speak out loud with Text-To-Speech (TTS)
    if (typeof AudioEngine !== 'undefined' && AudioEngine.speak) {
      AudioEngine.speak(cityMsg);
    }

    // Wait exactly 5 SECONDS after city rises up, then refresh the page!
    console.log('City network online! Waiting 5 seconds before page refresh...');
    setTimeout(() => {
      console.log('Refreshing page back to live server application...');
      window.location.reload();
    }, 5000);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastTs < 14) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    // Handle Earthquake & City Rise Transition Progress
    if (transitionState === 'EARTHQUAKE') {
      transitionProgress += dt * 0.35; // 3 second earthquake
      if (transitionProgress >= 0.25) {
        transitionState = 'TRANSITION';
      }
    } else if (transitionState === 'TRANSITION') {
      transitionProgress += dt * 0.35;
      if (transitionProgress >= 1.0) {
        transitionProgress = 1.0;
        transitionState = 'CITY';
        speakCityConnected(); // Trigger spoken message & 5s refresh timer!
      }
    }

    dayTime = (dayTime + dt / CFG.DAY_DURATION) % 1;

    const sky       = Sky.getState(dayTime);
    const near      = World.getNearEntities(Player.state.x, Player.state.z);
    Player.update(near);
    World.prune(Player.state.x, Player.state.z);
    
    Leaves.update(dt, Player.state.x, Player.state.z, Player.state.angle);
    DialogueSystem.update(dt, Player.state.isWalking);

    const worldData = World.getEntities(Player.state.x, Player.state.z, Player.state.angle);
    Renderer.render(Player.state, worldData, sky, transitionState, transitionProgress);
  }
  requestAnimationFrame(loop);
})();
