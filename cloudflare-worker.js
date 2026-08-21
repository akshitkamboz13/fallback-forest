/**
 * Cloudflare Worker: Home Server Health Checker & Earthquake Trigger
 * 
 * Deploy this script on Cloudflare Workers.
 * It checks if your home server is ONLINE and sends signal to the Server Down page
 * to trigger the earthquake and city rise animation!
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // Configure your Home Server URL here
    const HOME_SERVER_URL = env.HOME_SERVER_URL || "https://your-home-server.com/api/health";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const serverRes = await fetch(HOME_SERVER_URL, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (serverRes.ok || serverRes.status === 200 || serverRes.status === 304) {
        return new Response(JSON.stringify({
          status: "ONLINE",
          online: true,
          triggerEarthquake: true,
          message: "You found the city and network! Server is now connected!"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    } catch (err) {
      // Home server is still offline
    }

    return new Response(JSON.stringify({
      status: "OFFLINE",
      online: false,
      triggerEarthquake: false,
      message: "Server unreachable. Walking toward the city..."
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
