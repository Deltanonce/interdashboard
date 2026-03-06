// ============================================================
// config.js — Runtime endpoint strategy
// ============================================================
// Single explicit strategy:
// 1) Define window.CONFIG once in this file.
// 2) API_BASE_URL points to proxy root + /api (default localhost).
// 3) Runtime code derives endpoint paths from API_BASE_URL.
//
// NOTE: For public repos, keep sensitive keys out of this file.
window.CONFIG = {
    MAPBOX_API_KEY: 'pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2x4eXh5eXh5eXh5eXh5eXh5eXh5eXh5In0.xxxxxxxxxxxxx',
    API_BASE_URL: 'http://localhost:8888/api'
};

// Optional AIS browser key.
// Keep placeholder to force HTTP relay fallback unless explicitly configured.
window.AISSTREAM_API_KEY = 'GANTI_DENGAN_API_KEY_ANDA';
