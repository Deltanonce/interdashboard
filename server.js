const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT = __dirname;
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';

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
const AIS_MAX_BUFFER = 500;
const AIS_RECONNECT_MS = 5000;

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
    '.woff2': 'font/woff2'
};

const aisState = {
    connected: false,
    enabled: Boolean(AISSTREAM_API_KEY),
    messages: [],
    totalMessages: 0,
    lastMessageAt: null,
    lastError: null
};

let aisSocket = null;
let aisReconnectTimer = null;

function setCorsJson(res, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
}

function proxyAdsb(_req, res) {
    const options = {
        hostname: 'api.adsb.lol',
        path: '/v2/mil',
        method: 'GET',
        headers: { 'User-Agent': 'IntelDashboard/4.0' }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        const data = [];
        proxyRes.on('data', (chunk) => data.push(chunk));
        proxyRes.on('end', () => {
            const body = Buffer.concat(data);
            setCorsJson(res, 200);
            res.end(body);
        });
    });

    proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${err.message}`);
    });

    proxyReq.end();
}

function scheduleAisReconnect() {
    if (!aisState.enabled || aisReconnectTimer) return;
    aisReconnectTimer = setTimeout(() => {
        aisReconnectTimer = null;
        connectAisStream();
    }, AIS_RECONNECT_MS);
}

function connectAisStream() {
    if (!aisState.enabled) return;
    if (typeof WebSocket !== 'function') {
        aisState.lastError = 'WebSocket client is not available in this Node runtime';
        return;
    }
    if (aisSocket && (aisSocket.readyState === WebSocket.OPEN || aisSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    aisSocket = new WebSocket(AIS_WS_URL);

    aisSocket.onopen = () => {
        aisState.connected = true;
        aisState.lastError = null;
        const subscribeMsg = {
            Apikey: AISSTREAM_API_KEY,
            BoundingBoxes: AIS_BOUNDING_BOXES,
            FilterMessageTypes: ['PositionReport', 'ShipStaticData']
        };
        aisSocket.send(JSON.stringify(subscribeMsg));
        console.log('[AIS] Relay connected to aisstream.io.');
    };

    aisSocket.onmessage = (event) => {
        const payload = typeof event.data === 'string' ? event.data : event.data.toString();
        aisState.messages.push(payload);
        if (aisState.messages.length > AIS_MAX_BUFFER) {
            aisState.messages.splice(0, aisState.messages.length - AIS_MAX_BUFFER);
        }
        aisState.totalMessages += 1;
        aisState.lastMessageAt = new Date().toISOString();
    };

    aisSocket.onerror = () => {
        aisState.lastError = 'AIS stream socket error';
    };

    aisSocket.onclose = () => {
        aisState.connected = false;
        scheduleAisReconnect();
    };
}

function handleAisPoll(res) {
    const messages = aisState.messages;
    aisState.messages = [];
    setCorsJson(res, 200);
    res.end(JSON.stringify({
        connected: aisState.connected,
        count: aisState.totalMessages,
        messages
    }));
}

function handleAisStatus(res) {
    setCorsJson(res, 200);
    res.end(JSON.stringify({
        enabled: aisState.enabled,
        connected: aisState.connected,
        count: aisState.totalMessages,
        lastMessageAt: aisState.lastMessageAt,
        lastError: aisState.lastError
    }));
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/adsb-mil') return proxyAdsb(req, res);
    if (url === '/api/ais-poll') return handleAisPoll(res);
    if (url === '/api/ais-status') return handleAisStatus(res);

    const filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Not found: ${filePath}`);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`SERVER_READY on http://localhost:${PORT}/`);
    console.log(`ADS-B Proxy: http://localhost:${PORT}/api/adsb-mil`);
    console.log(`AIS key loaded: ${aisState.enabled ? 'yes' : 'no'}`);

    if (aisState.enabled) {
        connectAisStream();
    } else {
        console.warn('[AIS] AISSTREAM_API_KEY is not set. AIS relay endpoints will return disconnected status.');
    }
});
