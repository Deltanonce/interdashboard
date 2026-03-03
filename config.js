// ============================================================
// config.js — Environment Configuration
// WARNING: JANGAN commit file ini ke public repository!
// Tambahkan "config.js" ke .gitignore sebelum push ke GitHub/GitLab
// ============================================================
const CONFIG = {
    MAPBOX_API_KEY: 'pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2x4eXh5eXh5eXh5eXh5eXh5eXh5eXh5In0.xxxxxxxxxxxxx',
    API_BASE_URL: 'http://localhost:8888/api'
};

// AIS Stream API Key — https://aisstream.io
// KEAMANAN: Ganti nilai di bawah ini dengan key Anda.
// JANGAN push nilai asli key ini ke repository publik!
// Untuk production: gunakan environment variable atau .env file.
const AISSTREAM_API_KEY = 'GANTI_DENGAN_API_KEY_ANDA';
// Contoh penggunaan env var di Node.js proxy:
// const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';
