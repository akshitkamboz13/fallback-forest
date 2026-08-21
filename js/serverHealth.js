'use strict';
const ServerHealth = (() => {
  let isServerOnline = false;
  let checkInterval = null;
  let onRestoredCallback = null;

  let WORKER_ENDPOINT = window.WORKER_ENDPOINT || (window.location.origin + '/api/server-status');

  function setWorkerEndpoint(url) {
    WORKER_ENDPOINT = url;
  }

  function init(onRestored) {
    onRestoredCallback = onRestored;
    startPolling();

    if ('BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('server_status_channel');
        channel.onmessage = (event) => {
          if (event.data && (event.data.status === 'ONLINE' || event.data.triggerEarthquake)) {
            triggerServerRestored();
          }
        };
      } catch(e) {}
    }

    addEventListener('message', (event) => {
      if (event.data && (event.data === 'SERVER_ONLINE' || event.data.triggerEarthquake)) {
        triggerServerRestored();
      }
    });

    addEventListener('keydown', e => {
      if (e.code === 'KeyR' && e.shiftKey) {
        console.log('⚡ Shift+R trigger: Server Online signal received!');
        triggerServerRestored();
      }
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('trigger') === 'earthquake' || params.get('signal') === 'online') {
      setTimeout(() => triggerServerRestored(), 2000);
    }
  }

  function startPolling() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkStatus, 4000);
  }

  async function checkStatus() {
    if (isServerOnline) return;
    try {
      // Avoid fetch errors on static GitHub Pages hosting
      if (window.location.hostname.includes('github.io')) {
        return; // GitHub Pages is static; triggers via WORKER_ENDPOINT, postMessage, or Shift+R
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(WORKER_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({ online: false }));
        if (data.online || data.triggerEarthquake || data.status === 'ONLINE') {
          triggerServerRestored();
        }
      }
    } catch (e) {
      // Server still offline
    }
  }

  function triggerServerRestored() {
    if (isServerOnline) return;
    isServerOnline = true;
    if (checkInterval) clearInterval(checkInterval);
    console.log('⚡ Cloudflare Worker / Server Signal Received! Triggering Earthquake & City Rise...');
    if (onRestoredCallback) onRestoredCallback();
  }

  return { init, setWorkerEndpoint, triggerServerRestored };
})();
