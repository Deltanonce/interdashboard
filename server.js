const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const filterAdsbFlight = require('./adsb-filter');

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

// Strategic Priority Targets
const priorityTargets = ['K35R', 'R135', 'P8', 'C17', 'B52'];
const briefingSessions = new Set(); 
const intelligenceBuffer = new Map(); // RAM-only buffer for OMEGA PROTOCOL

function updateIntelligenceBuffer(ac) {
    if (!ac.hex) return;
    if (!intelligenceBuffer.has(ac.hex)) {
        intelligenceBuffer.set(ac.hex, {
            callsign: ac.callsign || 'N/A',
            type: (ac.t || 'N/A').toUpperCase(),
            reg: ac.r || 'N/A',
            history: []
        });
    }
    const data = intelligenceBuffer.get(ac.hex);
    data.history.push({
        alt: ac.alt_baro || ac.alt || 0,
        spd: ac.gs || ac.speed || 0,
        lat: ac.lat,
        lon: ac.lon,
        ts: Date.now()
    });
    // Keep last 50 telemetry points in RAM
    if (data.history.length > 50) data.history.shift();
}

function generateStrategicAssessment(ac) {
    const type = (ac.t || '').toUpperCase();
    if (type === 'K35R') return 'Aerial refueling platform. Indicates preparation for long-range strike or sustained Combat Air Patrol (CAP) in this sector.';
    if (type === 'R135') return 'Strategic reconnaissance / SIGINT. High-interest electronic monitoring or signal collection against regional targets detected.';
    if (type === 'P8') return 'Maritime patrol and ASW. Focus on surface/sub-surface monitoring in strategic maritime corridors.';
    if (type === 'B52') return 'Strategic bomber. High-level deterrence posture. Signifies significant escalation in regional strike capability.';
    if (type === 'C17' || type === 'C5') return 'Strategic heavy airlift. High-volume logistics throughput or troop deployment to regional hubs.';
    return 'Strategic asset presence suggests heightened operational readiness or specialized monitoring in the area.';
}

function logBriefing(ac) {
    if (!ac.hex || briefingSessions.has(ac.hex)) return;
    briefingSessions.add(ac.hex);

    const assessment = generateStrategicAssessment(ac);
    const briefing = {
        timestamp: new Date().toISOString(),
        id: ac.hex,
        callsign: ac.callsign || 'N/A',
        reg: ac.r || 'N/A',
        type: ac.t || 'N/A',
        status: {
            alt: ac.alt_baro || ac.alt || 0,
            spd: ac.gs || ac.speed || 0,
            hdg: ac.track || ac.heading || 0,
            lat: ac.lat,
            lon: ac.lon
        },
        assessment: assessment
    };

    updateIntelligenceBuffer(ac);

    const logEntry = JSON.stringify(briefing) + '\n';
    fs.appendFile(path.join(ROOT, 'briefings.log'), logEntry, (err) => {
        if (err) console.error('[BRIEFING] Failed to save log:', err);
    });
    console.log(`[BRIEFING] Strategic Alert: ${briefing.callsign} (${briefing.type})`);
}

function handleProximityAlert(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.targetHex && intelligenceBuffer.has(data.targetHex)) {
                const asset = intelligenceBuffer.get(data.targetHex);
                // Attach a proximity warning to the threat assessment in RAM
                asset.history.forEach(h => h.satProximity = data.satId);
                console.log(`[OMEGA] Satellite ${data.satId} proximity alert for target ${data.targetHex}`);
            }
        } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok' }));
    });
}

function generateReport(req, res) {
    const assets = Array.from(intelligenceBuffer.values());
    const timestamp = new Date().toISOString();
    
    let situationOverview = "OPERATIONAL READINESS: OPTIMAL. ";
    if (assets.length > 0) {
        situationOverview += `DETECTED ${assets.length} STRATEGIC ASSETS IN REGIONAL AIRSPACE. SATELLITE LINK STABLE.`;
    } else {
        situationOverview += "NO HIGH-VALUE TARGETS DETECTED IN CURRENT WINDOW. ROUTINE SWEEP ACTIVE.";
    }

    const identifiedThreats = assets.map(a => {
        const first = a.history[0];
        const last = a.history[a.history.length - 1];
        const altDelta = last.alt - first.alt;
        const trend = Math.abs(altDelta) < 500 ? "LEVEL" : (altDelta > 0 ? "CLIMBING" : "DESCENDING");
        
        const satWarning = a.history.some(h => h.satProximity) 
            ? ` [WARNING: SATELLITE OVERSIGHT VIA ${a.history.find(h => h.satProximity).satProximity}]` 
            : '';
            
        return `- ${a.callsign} [${a.type}] (${a.reg}): ${trend} @ ${last.alt}ft. SPEED ${last.spd}kts.${satWarning}`;
    }).join('\n') || "NONE DETECTED";

    let recommendation = "CONTINUE SENTINEL SWEEP. ";
    if (assets.some(a => ['R135', 'E3TF', 'E8'].includes(a.type))) {
        recommendation += "SIGINT ASSETS DETECTED. INITIATE COUNTER-SURVEILLANCE MEASURES.";
    } else if (assets.some(a => ['K35R'].includes(a.type))) {
        recommendation += "AERIAL REFUELING ACTIVE. EXPECT INCREASED SORTIE VOLUME.";
    } else if (assets.some(a => ['B52', 'F35', 'F22'].includes(a.type))) {
        recommendation += "STRIKE ASSETS ON RADAR. ALERT REGIONAL DEFENSE ASSETS.";
    }

    const report = {
        timestamp,
        title: "OMEGA PROTOCOL: STRATEGIC INTELLIGENCE SYNTHESIS",
        overview: situationOverview,
        threats: identifiedThreats,
        recommendation: recommendation
    };

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(report));
}

function proxyAdsb(req, res) {
    const options = {
        hostname: 'api.adsb.lol',
        path: '/v2/mil',
        method: 'GET',
        headers: { 'User-Agent': 'IntelDashboard/4.0' },
        timeout: 10000 // 10s timeout to prevent hanging connections
    };

    const proxyReq = https.request(options, (proxyRes) => {
        const data = [];
        let totalLength = 0;
        const MAX_PAYLOAD = 15 * 1024 * 1024; // 15MB limit

        proxyRes.on('data', chunk => {
            totalLength += chunk.length;
            if (totalLength > MAX_PAYLOAD) {
                proxyReq.destroy();
                if (!res.headersSent) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Payload Too Large', message: 'Upstream data exceeds 15MB limit' }));
                }
                return;
            }
            data.push(chunk);
        });

        proxyRes.on('end', () => {
            if (res.finished) return;

            const status = proxyRes.statusCode || 502;
            const body = Buffer.concat(data);

            // Handle upstream errors (502, 504, etc.) gracefully
            if (status < 200 || status >= 300) {
                res.writeHead(status, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ 
                    error: `Upstream error ${status}`, 
                    message: 'The ADS-B provider is currently unreachable or returned an error.' 
                }));
                return;
            }

            // Optimize: Offload parsing to next tick to keep event loop responsive
            setImmediate(() => {
                try {
                    const payload = JSON.parse(body.toString('utf8'));
                    const rawList = payload.ac || payload.aircraft || [];
                    const rawCount = rawList.length;

                    // Apply regional filter
                    if (Array.isArray(payload.ac)) {
                        payload.ac = payload.ac.filter(filterAdsbFlight);
                    } else if (Array.isArray(payload.aircraft)) {
                        payload.aircraft = payload.aircraft.filter(filterAdsbFlight);
                    }

                    const filteredList = payload.ac || payload.aircraft || [];
                    const filteredCount = filteredList.length;

                    // Priority Target Detection
                    filteredList.forEach(ac => {
                        const type = (ac.t || '').toUpperCase();
                        if (priorityTargets.includes(type)) {
                            ac.priority = true;
                            ac.reason = 'Strategic Asset Detected';
                            logBriefing(ac);
                        } else if (ac.r && (ac.r.startsWith('62-') || ac.r.startsWith('64-') || ac.r.startsWith('AE'))) {
                            ac.priority = true;
                            ac.reason = 'Strategic Asset Detected';
                            logBriefing(ac);
                        }
                    });

                    console.log(`[ADS-B] API Request: Total Raw: ${rawCount} | Total Filtered: ${filteredCount}`);

                    // Debugging: If raw data exists but all are filtered out, log sample coordinates
                    if (filteredCount === 0 && rawCount > 0) {
                        const sample = rawList.slice(0, 3).map(ac => {
                            const lat = ac.lat ?? ac.latitude;
                            const lon = ac.lon ?? ac.longitude ?? ac.lng;
                            return `(lat:${lat}, lon:${lon}, mil:${ac.isMilitary})`;
                        }).join(' | ');
                        console.warn(`[ADS-B] Filter rejection sample: ${sample}`);
                    }

                    const responseBody = JSON.stringify(payload);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-store'
                    });
                    res.end(responseBody);
                } catch (err) {
                    res.writeHead(502, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ error: 'Failed to parse ADS-B payload' }));
                }
            });
        });
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Timeout', message: 'Upstream ADS-B request timed out' }));
    });

    proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
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

function getStatus(req, res) {
    // Strictly check if API key is provided and not the default placeholder
    const isKeyActive = !!(AIS_KEY && AIS_KEY.length > 5 && AIS_KEY !== 'GANTI_DENGAN_API_KEY_ANDA');
    
    const body = JSON.stringify({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        ais_key_active: isKeyActive,
        ais_connected: aisState.connected,
        last_seen: aisState.lastSeen,
        port: PORT,
        host: HOST
    });

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function getBriefings(req, res) {
    const logPath = path.join(ROOT, 'briefings.log');
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify([]));
            return;
        }
        
        const lines = data.trim().split('\n').filter(Boolean).map(line => {
            try { return JSON.parse(line); } catch(e) { return null; }
        }).filter(Boolean);

        // Limit to last 50 briefings
        const latest = lines.slice(-50).reverse();

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(latest));
    });
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/adsb-mil') return proxyAdsb(req, res);
    if (url === '/api/ais-poll') return pollAis(req, res);
    if (url === '/api/status') return getStatus(req, res);
    if (url === '/api/briefings') return getBriefings(req, res);
    if (url === '/api/generate-report') return generateReport(req, res);
    if (url === '/api/proximity-alert') return handleProximityAlert(req, res);

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
