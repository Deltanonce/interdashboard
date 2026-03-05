const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const AISSTREAM_WS_URL = 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';
const AIS_BOUNDING_BOXES = [
    [[12, 41], [30, 44]],
    [[23, 48], [30, 57]],
    [[11, 43], [16, 51]],
    [[30, 31], [32, 35]],
    [[-2, 100], [8, 110]],
    [[-5, 105], [10, 120]],
    [[20, 115], [28, 125]]
];
const MAX_AIS_BUFFER_MESSAGES = 250;

const PORT = 8888;
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

const aisRelay = {
    socket: null,
    connected: false,
    connecting: false,
    totalCount: 0,
    pendingMessages: [],
    reconnectTimer: null,
    reconnectDelayMs: 2000,
    lastError: null
};

function writeJson(res, statusCode, body) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(body));
}

function resolveWebSocketCtor() {
    if (typeof globalThis.WebSocket === 'function') {
        return globalThis.WebSocket;
    }
    try {
        return require('ws');
    } catch (_) {
        return null;
    }
}

function scheduleAisReconnect() {
    if (aisRelay.reconnectTimer || !AISSTREAM_API_KEY) {
        return;
    }
    aisRelay.reconnectTimer = setTimeout(() => {
        aisRelay.reconnectTimer = null;
        connectAisRelay();
    }, aisRelay.reconnectDelayMs);
    aisRelay.reconnectDelayMs = Math.min(aisRelay.reconnectDelayMs * 2, 30000);
}

function connectAisRelay() {
    if (!AISSTREAM_API_KEY || aisRelay.connected || aisRelay.connecting) {
        return;
    }

    const WebSocketCtor = resolveWebSocketCtor();
    if (!WebSocketCtor) {
        aisRelay.lastError = 'WebSocket support unavailable in this runtime';
        return;
    }

    aisRelay.connecting = true;
    const socket = new WebSocketCtor(AISSTREAM_WS_URL);
    aisRelay.socket = socket;

    socket.onopen = () => {
        aisRelay.connecting = false;
        aisRelay.connected = true;
        aisRelay.lastError = null;
        aisRelay.reconnectDelayMs = 2000;

        const subscribePayload = {
            Apikey: AISSTREAM_API_KEY,
            BoundingBoxes: AIS_BOUNDING_BOXES,
            FilterMessageTypes: ['PositionReport', 'ShipStaticData']
        };
        socket.send(JSON.stringify(subscribePayload));
    };

    socket.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            aisRelay.pendingMessages.push(parsed);
            if (aisRelay.pendingMessages.length > MAX_AIS_BUFFER_MESSAGES) {
                aisRelay.pendingMessages.splice(0, aisRelay.pendingMessages.length - MAX_AIS_BUFFER_MESSAGES);
            }
            aisRelay.totalCount += 1;
        } catch (err) {
            aisRelay.lastError = 'Failed to parse AIS message: ' + err.message;
        }
    };

    const handleCloseOrError = (err) => {
        aisRelay.connecting = false;
        aisRelay.connected = false;
        if (err?.message) {
            aisRelay.lastError = err.message;
        }
        scheduleAisReconnect();
    };

    socket.onerror = handleCloseOrError;
    socket.onclose = handleCloseOrError;
}

function proxyAisPoll(_req, res) {
    if (!AISSTREAM_API_KEY) {
        return writeJson(res, 200, {
            connected: false,
            messages: [],
            count: 0,
            error: 'AISSTREAM_API_KEY is not configured'
        });
    }

    connectAisRelay();

    const messages = aisRelay.pendingMessages.splice(0, aisRelay.pendingMessages.length);
    return writeJson(res, 200, {
        connected: aisRelay.connected,
        messages,
        count: aisRelay.totalCount,
        error: aisRelay.lastError
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
        let data = [];
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

    // CORS proxy for ADS-B
    if (url === '/api/adsb-mil') {
        return proxyAdsb(req, res);
    }

    if (url === '/api/ais-poll') {
        return proxyAisPoll(req, res);
    }

    // Static file serving
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
    if (AISSTREAM_API_KEY) {
        console.log(`AIS Relay Poll: http://localhost:${PORT}/api/ais-poll`);
        connectAisRelay();
    } else {
        console.log('AIS Relay disabled: set AISSTREAM_API_KEY to enable /api/ais-poll streaming relay.');
    }
});
