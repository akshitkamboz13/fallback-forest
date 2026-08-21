'use strict';
const DialogueSystem = (() => {
  let dialogues = [];
  let currentIndex = 0;
  let timer = 0;
  let hudEl = null;
  let textEl = null;
  let hideTimeout = null;
  let lastWalkTime = 0;

  function init() {
    hudEl = document.getElementById('dialogue-hud');
    textEl = document.getElementById('dialogue-text');

    // Access pre-loaded dialogues array (bypasses CORS file:// fetch restrictions)
    if (window.DIALOGUES && window.DIALOGUES.length) {
      dialogues = [...window.DIALOGUES];
      // Shuffle dialogues randomly
      dialogues.sort(() => Math.random() - 0.5);
    } else {
      dialogues = [
        "Is it just me, or does every tree look identical when you're lost?",
        "Starlin promised internet to this jungle, but without electricity, how am I supposed to recharge?",
        "Doodle Maps told me to turn right into a ravine. Thanks, Goggles, very helpful.",
        "Beta promised the Metaverse would replace real nature. At least in Beta I could mute mosquitoes.",
        "If I survive this hike, I am legally binding myself to my couch for the rest of eternity."
      ];
    }

    // Trigger initial welcome monologue after 2.2 seconds
    setTimeout(() => {
      triggerDialogue();
    }, 2200);
  }

  function triggerDialogue() {
    if (!dialogues.length || !hudEl || !textEl) return;

    if (hideTimeout) clearTimeout(hideTimeout);

    const line = dialogues[currentIndex % dialogues.length];
    currentIndex++;

    textEl.textContent = `"${line}"`;
    hudEl.classList.add('active');

    // Trigger SpeechSynthesis (TTS) + Web Audio vocal chatter!
    if (typeof AudioEngine !== 'undefined' && AudioEngine.speak) {
      AudioEngine.speak(line);
    }

    // Auto-hide subtitle banner after 8 seconds
    hideTimeout = setTimeout(() => {
      hudEl.classList.remove('active');
    }, 8000);
  }

  function update(dt, isWalking) {
    timer += dt;
    if (isWalking) {
      lastWalkTime = timer;
    }

    // Trigger a monologue every ~10 seconds while walking or exploring
    if (timer > 10.0) {
      timer = 0;
      if (isWalking || (lastWalkTime > 0 && Math.random() > 0.35)) {
        triggerDialogue();
      }
    }
  }

  return { init, update, triggerDialogue };
})();
