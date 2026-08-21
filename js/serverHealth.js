'use strict';
const ServerHealth = (() => {
  let isServerOnline = false;
  let checkInterval = null;
  let onRestoredCallback = null;

  // Endpoint polled by client (Can be set to your Cloudflare Worker URL)
  // Example: 'https://home-server-health.your-name.workers.dev'
  let WORKER_ENDPOINT = window.WORKER_ENDPOINT || (window.location.origin + '/api/server-status');

  function setWorkerEndpoint(url) {
    WORKER_ENDPOINT = url;
  }

  function init(onRestored) {
    onRestoredCallback = onRestored;
    startPolling();

    // 1. BroadcastChannel Listener (For multi-tab or local worker triggers)
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

    // 2. Window PostMessage Listener (Allows Cloudflare Worker / iframe pings)
    addEventListener('message', (event) => {
      if (event.data && (event.data === 'SERVER_ONLINE' || event.data.triggerEarthquake)) {
        triggerServerRestored();
      }
    });

    // 3. Shift+R Keyboard Shortcut (Manual testing trigger)
    addEventListener('keydown', e => {
      if (e.code === 'KeyR' && e.shiftKey) {
        console.log('⚡ Manual Shift+R trigger: Server Online signal received!');
        triggerServerRestored();
      }
    });

    // 4. URL parameter ?trigger=earthquake or ?signal=online
    const params = new URLSearchParams(window.location.search);
    if (params.get('trigger') === 'earthquake' || params.get('signal') === 'online') {
      setTimeout(() => triggerServerRestored(), 2000);
    }
  }

  function startPolling() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkStatus, 4000); // Check every 4 seconds
  }

  async function checkStatus() {
    if (isServerOnline) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3200);

      // Poll Cloudflare Worker or Home Server endpoint
      const res = await fetch(WORKER_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({ online: true }));
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
