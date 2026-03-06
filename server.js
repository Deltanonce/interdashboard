const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let NodeWebSocket = null;
if (typeof WebSocket !== 'undefined') {
    NodeWebSocket = WebSocket;
} else {
    try {
        NodeWebSocket = require('ws');
    } catch (err) {
        NodeWebSocket = null;
    }
}

const PORT = Number.parseInt(process.env.PORT || '8888', 10);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;

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

const AIS_WS_URL = 'wss://stream.aisstream.io/v0/stream';
const AIS_BOUNDING_BOXES = [
    [[12, 41], [30, 44]],
    [[23, 48], [30, 57]],
    [[11, 43], [16, 51]],
    [[30, 31], [32, 35]],
    [[-2, 100], [8, 110]],
    [[-5, 105], [10, 120]],
    [[20, 115], [28, 125]]
];
const MAX_AIS_MESSAGES = 500;
const aisState = {
    connected: false,
    messages: [],
    lastError: null,
    lastSeen: null,
    reconnectDelayMs: 3000,
    ws: null
};

const AIS_KEY = process.env.AISSTREAM_API_KEY || '';

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
            const status = proxyRes.statusCode || 502;
            res.writeHead(status, {
                'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store'
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

function startAisRelay() {
    if (!AIS_KEY || AIS_KEY === 'GANTI_DENGAN_API_KEY_ANDA') {
        console.warn('[AIS] Relay disabled: AISSTREAM_API_KEY not configured in environment.');
        return;
    }

    if (!NodeWebSocket) {
        console.warn('[AIS] Relay disabled: WebSocket runtime unavailable. Install dependency: npm install ws');
        return;
    }

    const connect = () => {
        try {
            const ws = new NodeWebSocket(AIS_WS_URL);
            aisState.ws = ws;

            ws.on('open', () => {
                aisState.connected = true;
                aisState.lastError = null;
                aisState.reconnectDelayMs = 3000;
                ws.send(JSON.stringify({
                    Apikey: AIS_KEY,
                    BoundingBoxes: AIS_BOUNDING_BOXES,
                    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
                }));
                console.log('[AIS] Relay connected.');
            });

            ws.on('message', (event) => {
                const payload = typeof event === 'string' ? event : event.toString();
                aisState.messages.push(payload);
                if (aisState.messages.length > MAX_AIS_MESSAGES) {
                    aisState.messages = aisState.messages.slice(-MAX_AIS_MESSAGES);
                }
                aisState.lastSeen = new Date().toISOString();
            });

            ws.on('error', () => {
                aisState.connected = false;
                aisState.lastError = 'WebSocket error';
            });

            ws.on('close', () => {
                aisState.connected = false;
                aisState.ws = null;
                setTimeout(connect, aisState.reconnectDelayMs);
                aisState.reconnectDelayMs = Math.min(30000, aisState.reconnectDelayMs * 2);
            });
        } catch (err) {
            aisState.connected = false;
            aisState.lastError = err.message;
            setTimeout(connect, aisState.reconnectDelayMs);
            aisState.reconnectDelayMs = Math.min(30000, aisState.reconnectDelayMs * 2);
        }
    };

    connect();
}

function pollAis(req, res) {
    const batch = aisState.messages.splice(0, aisState.messages.length);
    const body = JSON.stringify({
        connected: aisState.connected || batch.length > 0,
        messages: batch,
        count: batch.length,
        lastSeen: aisState.lastSeen,
        lastError: aisState.lastError
    });

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function resolveStaticPath(reqUrl) {
    const parsed = new URL(reqUrl, `http://localhost:${PORT}`);
    let requestPath = '/';
    try {
        requestPath = decodeURIComponent(parsed.pathname || '/');
    } catch {
        return null;
    }
    if (requestPath === '/') requestPath = '/index.html';

    const normalized = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const relative = normalized.replace(/^[/\\]+/, '');
    const absolute = path.resolve(ROOT, relative);
    const rootResolved = path.resolve(ROOT) + path.sep;
    if (!absolute.startsWith(rootResolved)) return null;
    return absolute;
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/adsb-mil') return proxyAdsb(req, res);
    if (url === '/api/ais-poll') return pollAis(req, res);

    const filePath = resolveStaticPath(req.url || '/');
    if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid path');
        return;
    }
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

startAisRelay();

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`[SERVER] Port ${PORT} already in use on ${HOST}. Set a different PORT.`);
        process.exitCode = 1;
        return;
    }
    if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
        console.error(`[SERVER] Permission denied binding ${HOST}:${PORT}. Try HOST=127.0.0.1 or a different PORT.`);
        process.exitCode = 1;
        return;
    }
    console.error('[SERVER] Failed to start:', err);
    process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
    console.log(`SERVER_READY on http://${HOST}:${PORT}/`);
    console.log(`ADS-B Proxy: http://${HOST}:${PORT}/api/adsb-mil`);
    console.log(`AIS Proxy:   http://${HOST}:${PORT}/api/ais-poll`);
});
