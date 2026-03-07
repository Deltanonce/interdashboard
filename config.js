// config.js — PLACEHOLDER
// The actual config is served dynamically by server.js via the /config.js route,
// which injects CESIUM_ACCESS_TOKEN from the server's .env file.
// This static file exists only as a fallback for offline/direct-file usage.
if (typeof window.CESIUM_ACCESS_TOKEN === 'undefined') {
    window.CESIUM_ACCESS_TOKEN = '';
}
