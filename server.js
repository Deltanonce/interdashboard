const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT = __dirname;
const AIS_WS_URL = 'wss://stream.aisstream.io/v0/stream';
const AIS_POLL_LIMIT = 1500;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.geojson': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
};

const AIS_BOUNDING_BOXES = [
    [[12, 41], [30, 44]],
    [[23, 48], [30, 57]],
    [[11, 43], [16, 51]],
    [[30, 31], [32, 35]],
    [[-2, 100], [8, 110]],
    [[-5, 105], [10, 120]],
    [[20, 115], [28, 125]]
];

let aisCache = [];
let aisConnected = false;
let aisEverConnected = false;
let aisReconnectTimer = null;
let aisLastError = null;

function readAisKeyFromConfig() {
    const fromEnv = process.env.AISSTREAM_API_KEY;
    if (fromEnv && fromEnv.length >= 10) return fromEnv;

    try {
        const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
        const match = cfg.match(/AISSTREAM_API_KEY\s*=\s*['\"]([^'\"]+)['\"]/);
        const key = match ? match[1] : '';
        if (key && key.length >= 10 && key !== 'GANTI_DENGAN_API_KEY_ANDA') return key;
    } catch (err) {
        // ignore, endpoint can still serve disconnected state
    }
    return '';
}

const AIS_API_KEY = readAisKeyFromConfig();

function pushAisMessage(message) {
    aisCache.push(message);
    if (aisCache.length > AIS_POLL_LIMIT) {
        aisCache.splice(0, aisCache.length - AIS_POLL_LIMIT);
    }
}

function scheduleAisReconnect(delayMs = 4000) {
    if (aisReconnectTimer) clearTimeout(aisReconnectTimer);
    aisReconnectTimer = setTimeout(() => connectAisRelay(), delayMs);
}

function connectAisRelay() {
    if (!AIS_API_KEY) {
        console.warn('[AIS] No API key (env/config.js). /api/ais-poll will return disconnected state.');
        aisConnected = false;
        return;
    }

    let WebSocket;
    try {
        WebSocket = require('ws');
    } catch (err) {
        console.warn('[AIS] Missing dependency "ws". Install with: npm i ws');
        aisConnected = false;
        aisLastError = 'missing_ws_module';
        return;
    }

    console.log('[AIS] Connecting relay to aisstream.io...');
    const ws = new WebSocket(AIS_WS_URL);

    ws.on('open', () => {
        aisConnected = true;
        aisEverConnected = true;
        aisLastError = null;
        const sub = {
            Apikey: AIS_API_KEY,
            BoundingBoxes: AIS_BOUNDING_BOXES,
            FilterMessageTypes: ['PositionReport', 'ShipStaticData']
        };
        ws.send(JSON.stringify(sub));
        console.log('[AIS] Relay connected and subscribed.');
    });

    ws.on('message', (buffer) => {
        pushAisMessage(buffer.toString());
    });

    ws.on('close', (code, reason) => {
        aisConnected = false;
        aisLastError = `close_${code}_${String(reason || '').slice(0, 60)}`;
        console.warn(`[AIS] Relay closed (${code}) — reconnecting...`);
        scheduleAisReconnect();
    });

    ws.on('error', (err) => {
        aisConnected = false;
        aisLastError = err.message;
        console.warn('[AIS] Relay error:', err.message);
    });
}

function proxyAdsb(req, res) {
    const options = {
        hostname: 'api.adsb.lol',
        path: '/v2/mil',
        method: 'GET',
        headers: { 'User-Agent': 'IntelDashboard/4.0' }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        const data = [];
        proxyRes.on('data', chunk => data.push(chunk));
        proxyRes.on('end', () => {
            const body = Buffer.concat(data);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
        });
    });

    proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy error: ' + err.message);
    });

    proxyReq.end();
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/adsb-mil') return proxyAdsb(req, res);

    if (url === '/api/ais-poll') {
        const messages = aisCache.splice(0, aisCache.length);
        const payload = {
            connected: aisConnected || aisEverConnected || messages.length > 0,
            messages,
            count: messages.length,
            timestamp: new Date().toISOString(),
            relay: {
                connected: aisConnected,
                everConnected: aisEverConnected,
                lastError: aisLastError
            }
        };
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(payload));
    }

    let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + filePath);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`SERVER_READY on http://localhost:${PORT}/`);
    console.log(`ADS-B Proxy: http://localhost:${PORT}/api/adsb-mil`);
    console.log(`AIS Proxy:   http://localhost:${PORT}/api/ais-poll`);
    connectAisRelay();
});
