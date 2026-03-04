const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT = __dirname;
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

const aisState = {
    ws: null,
    queue: [],
    connected: false,
    everConnected: false,
    reconnectTimer: null,
    retryDelayMs: 2000,
    maxQueue: 500,
};

function getAisApiKey() {
    if (process.env.AISSTREAM_API_KEY && process.env.AISSTREAM_API_KEY.length > 10) {
        return process.env.AISSTREAM_API_KEY.trim();
    }

    const configPath = path.join(ROOT, 'config.js');
    if (!fs.existsSync(configPath)) return '';
    const config = fs.readFileSync(configPath, 'utf8');
    const match = config.match(/AISSTREAM_API_KEY\s*=\s*['\"]([^'\"]+)['\"]/);
    const key = match ? match[1].trim() : '';
    return key === 'GANTI_DENGAN_API_KEY_ANDA' ? '' : key;
}

function queueAisMessage(msg) {
    aisState.queue.push(msg);
    if (aisState.queue.length > aisState.maxQueue) {
        aisState.queue.splice(0, aisState.queue.length - aisState.maxQueue);
    }
}

function scheduleAisReconnect() {
    clearTimeout(aisState.reconnectTimer);
    aisState.reconnectTimer = setTimeout(() => {
        aisState.retryDelayMs = Math.min(aisState.retryDelayMs * 2, 30000);
        startAisCollector();
    }, aisState.retryDelayMs);
}

function startAisCollector() {
    const apiKey = getAisApiKey();
    if (!apiKey) {
        console.warn('[AIS] API key is missing. Set AISSTREAM_API_KEY (env) or config.js to enable ship tracking.');
        return;
    }

    if (aisState.ws && (aisState.ws.readyState === WebSocket.OPEN || aisState.ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    try {
        const ws = new WebSocket(AIS_WS_URL);
        aisState.ws = ws;

        ws.onopen = () => {
            aisState.connected = true;
            aisState.everConnected = true;
            aisState.retryDelayMs = 2000;
            const subscribeMsg = {
                Apikey: apiKey,
                BoundingBoxes: AIS_BOUNDING_BOXES,
                FilterMessageTypes: ['PositionReport', 'ShipStaticData']
            };
            ws.send(JSON.stringify(subscribeMsg));
            console.log('[AIS] Server relay connected to aisstream.io');
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                queueAisMessage(event.data);
            }
        };

        ws.onclose = (event) => {
            aisState.connected = false;
            console.warn(`[AIS] Relay disconnected (code=${event.code}, reason=${event.reason || 'none'})`);
            scheduleAisReconnect();
        };

        ws.onerror = (err) => {
            aisState.connected = false;
            console.warn('[AIS] Relay socket error:', err?.message || err);
        };
    } catch (err) {
        aisState.connected = false;
        console.warn('[AIS] Relay startup failed:', err.message);
        scheduleAisReconnect();
    }
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

function handleAisPoll(res) {
    const apiKeyConfigured = !!getAisApiKey();
    const payload = {
        connected: aisState.connected || (aisState.everConnected && aisState.queue.length > 0),
        messages: [...aisState.queue],
        count: aisState.queue.length,
        timestamp: new Date().toISOString(),
        configured: apiKeyConfigured,
    };

    aisState.queue = [];

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/adsb-mil') {
        return proxyAdsb(req, res);
    }

    if (url === '/api/ais-poll') {
        return handleAisPoll(res);
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
    startAisCollector();
});
