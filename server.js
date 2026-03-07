const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { validateEnv } = require('./scripts/validate-env');

// Validate environment on startup
try {
    require('dotenv').config();
} catch (e) {}
validateEnv();

const filterAdsbFlight = require('./adsb-filter');
const { sendPriorityTargetAlert, sendADIZAlert } = require('./telegram-alerts');
const { checkADIZEntry } = require('./adiz-zones');
const BriefingScheduler = require('./briefing-scheduler');
const HealthMonitor = require('./health-monitor');
const helmet = require('helmet');
const cors = require('cors');
const RateLimiter = require('./security/rate-limiter');
const SecretsManager = require('./security/secrets-manager');
const InputValidator = require('./security/input-validator');

// Initialize security components
const rateLimiter = new RateLimiter({ maxRequests: 150 });
const corsHandler = cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8888'],
    methods: ['GET', 'POST'],
    credentials: true,
    maxAge: 86400
});

const helmetHandler = helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "blob:", "https://cdnjs.cloudflare.com", "https://cesium.com", "https://dev.virtualearth.net"],
            "script-src-attr": ["'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:", "blob:"],
            "media-src": ["*"],
            "frame-src": ["'self'", "https://www.youtube.com", "https://youtube.com"],
            "worker-src": ["'self'", "blob:"],
            "connect-src": [
                "'self'",
                "https://api.adsb.lol",
                "wss://stream.aisstream.io",
                "https://celestrak.org",
                "https://services.arcgisonline.com",
                "https://iserver.arcgisonline.com",
                "https://api.cesium.com",
                "https://assets.ion.cesium.com",
                "https://assets.cesium.com",
                "https://ion.cesium.com",
                "https://cesium.com",
                "https://dev.virtualearth.net",
                "https://*.virtualearth.net",
                "https://*.bing.com"
            ]
        }
    }
});

function requireAPIKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API key required' }));
        return;
    }
    if (!SecretsManager.validateAPIKey('client', apiKey)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return;
    }
    next();
}

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

// Initialize Briefing Scheduler
const briefingScheduler = new BriefingScheduler(intelligenceBuffer);
briefingScheduler.start();

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
    HealthMonitor.recordBriefing();

    const logEntry = JSON.stringify(briefing) + '\n';
    fs.appendFile(path.join(ROOT, 'briefings.log'), logEntry, (err) => {
        if (err) console.error('[BRIEFING] Failed to save log:', err);
    });
    console.log(`[BRIEFING] Strategic Alert: ${briefing.callsign} (${briefing.type})`);

    // ── TELEGRAM STRATEGIC ALERTS ──
    if (ac.priority) {
        sendPriorityTargetAlert({
            id: ac.hex,
            callsign: ac.callsign || 'N/A',
            aircraftType: ac.t || 'N/A',
            hex: ac.hex,
            lat: ac.lat,
            lon: ac.lon,
            altitude: ac.alt_baro || ac.alt || 0,
            speed: ac.gs || ac.speed || 0,
            heading: ac.track || ac.heading || 0,
            squawk: ac.squawk
        }).then(() => HealthMonitor.recordAlert(true))
          .catch(err => {
            HealthMonitor.recordAlert(false);
            console.error('[TELEGRAM] Priority alert failed:', err.message);
          });

        // ADIZ Incursion Monitoring
        const zones = checkADIZEntry({ lat: ac.lat, lon: ac.lon });
        for (const zone of zones) {
            sendADIZAlert({
                id: ac.hex,
                callsign: ac.callsign || 'N/A',
                aircraftType: ac.t || 'N/A',
                hex: ac.hex,
                lat: ac.lat,
                lon: ac.lon
            }, zone.name).then(() => HealthMonitor.recordAlert(true))
              .catch(err => {
                HealthMonitor.recordAlert(false);
                console.error('[TELEGRAM] ADIZ alert failed:', err.message);
              });
        }
    }
}

// ── YOUTUBE LIVE STREAM RESOLVER ──
// Resolves a YouTube channel ID to the current live video ID.
// Uses multiple strategies: redirect detection, HTML parsing, and YouTube's oembed endpoint.
// Results are cached for 30 minutes to avoid excessive requests.
const _ytStreamCache = new Map(); // channelId → { videoId, ts }
const YT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Follow redirects manually for https.request (Node https doesn't auto-follow).
 * Returns a promise that resolves with the final response body as a string.
 * Also checks redirect URLs for embedded video IDs.
 */
function _ytFetchWithRedirects(urlStr, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const doRequest = (currentUrl, redirectsLeft) => {
            const parsed = new URL(currentUrl);
            const reqOpts = {
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cookie': 'CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODE1LjA3X3AxGgJlbiACGgYIgJnsBhAB'
                },
                timeout: 12000
            };

            const req = https.request(reqOpts, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume(); // drain
                    if (redirectsLeft <= 0) {
                        return reject(new Error('Too many redirects'));
                    }
                    let loc = res.headers.location;
                    // Handle relative redirects
                    if (loc.startsWith('/')) {
                        loc = `https://${parsed.hostname}${loc}`;
                    }
                    // Check if redirect URL itself contains a video ID
                    const vidInUrl = loc.match(/[?&]v=([A-Za-z0-9_-]{11})/);
                    if (vidInUrl) {
                        return resolve({ redirectVideoId: vidInUrl[1], body: '', finalUrl: loc });
                    }
                    return doRequest(loc, redirectsLeft - 1);
                }

                const chunks = [];
                let totalLength = 0;
                res.on('data', chunk => {
                    totalLength += chunk.length;
                    if (totalLength < 2 * 1024 * 1024) chunks.push(chunk);
                });
                res.on('end', () => {
                    const body = Buffer.concat(chunks).toString('utf8');
                    resolve({ body, finalUrl: currentUrl, redirectVideoId: null });
                });
            });

            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.on('error', (err) => reject(err));
            req.end();
        };

        doRequest(urlStr, maxRedirects);
    });
}

function resolveYouTubeStream(req, res) {
    const parsed = new URL(req.url, `http://localhost:${PORT}`);
    const channelId = parsed.searchParams.get('channel');

    if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid or missing channel parameter. Must be a YouTube channel ID (UC...)' }));
        return;
    }

    // Check cache
    const cached = _ytStreamCache.get(channelId);
    if (cached && (Date.now() - cached.ts) < YT_CACHE_TTL) {
        console.log(`[YT-RESOLVE] Cache hit for ${channelId}: ${cached.videoId || 'NO_STREAM'}`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ channelId, videoId: cached.videoId, cached: true, live: !!cached.videoId }));
        return;
    }

    const ytUrl = `https://www.youtube.com/channel/${channelId}/live`;
    console.log(`[YT-RESOLVE] Fetching live page for channel ${channelId}`);

    _ytFetchWithRedirects(ytUrl)
        .then(({ body: html, redirectVideoId }) => {
            let videoId = redirectVideoId || null;

            if (!videoId && html) {
                // Method 1: Canonical URL (most reliable — YouTube sets this to the current live video)
                const canonMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/);
                if (canonMatch) videoId = canonMatch[1];

                // Method 2: og:url meta tag
                if (!videoId) {
                    const ogMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/);
                    if (ogMatch) videoId = ogMatch[1];
                }

                // Method 3: ytInitialPlayerResponse with isLive
                if (!videoId) {
                    const playerRespMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|<\/script)/s);
                    if (playerRespMatch) {
                        try {
                            const data = JSON.parse(playerRespMatch[1]);
                            if (data?.videoDetails?.videoId && data?.videoDetails?.isLive) {
                                videoId = data.videoDetails.videoId;
                            }
                        } catch (_) {}
                    }
                }

                // Method 4: videoId near isLive or isLiveNow in JSON data
                if (!videoId) {
                    const liveMatch = html.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"[^}]{0,500}"isLive(?:Now)?"\s*:\s*true/);
                    if (liveMatch) videoId = liveMatch[1];
                }

                // Method 5: Reverse — isLive near videoId
                if (!videoId) {
                    const revMatch = html.match(/"isLive(?:Now)?"\s*:\s*true[^}]{0,500}"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/);
                    if (revMatch) videoId = revMatch[1];
                }

                // Method 6: Any videoId on the page (fallback)
                if (!videoId) {
                    const broadMatch = html.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/);
                    if (broadMatch) videoId = broadMatch[1];
                }
            }

            _ytStreamCache.set(channelId, { videoId, ts: Date.now() });

            if (videoId) {
                console.log(`[YT-RESOLVE] Resolved: ${channelId} → ${videoId}`);
            } else {
                console.warn(`[YT-RESOLVE] No live stream found for channel ${channelId} (HTML length: ${html?.length || 0})`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ channelId, videoId, cached: false, live: !!videoId }));
        })
        .catch((err) => {
            console.error(`[YT-RESOLVE] Error for channel ${channelId}: ${err.message}`);
            _ytStreamCache.set(channelId, { videoId: null, ts: Date.now() - YT_CACHE_TTL + 5 * 60 * 1000 });

            const status = err.message === 'Timeout' ? 504 : 502;
            res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message, channelId, videoId: null, live: false }));
        });
}

function proxyTrafficCams(req, res) {
    try {
        const parsed = new URL(req.url, `http://localhost:${PORT}`);
        const targetUrl = parsed.searchParams.get('url');
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }
        // Only allow Austin open data domain
        let parsedTarget;
        try { parsedTarget = new URL(targetUrl); } catch {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Invalid URL' }));
            return;
        }
        if (parsedTarget.hostname !== 'data.austintexas.gov') {
            res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Domain not allowed' }));
            return;
        }
        console.log(`[PROXY] Traffic cams -> ${parsedTarget.pathname}`);
        const proxyReq = https.request(targetUrl, { timeout: 10000 }, (proxyRes) => {
            const chunks = [];
            proxyRes.on('data', c => chunks.push(c));
            proxyRes.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                const status = proxyRes.statusCode >= 200 && proxyRes.statusCode < 300 ? 200 : proxyRes.statusCode;
                res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(body);
            });
        });
        proxyReq.on('error', (err) => {
            console.error('[PROXY] Traffic cams upstream error:', err.message);
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Upstream traffic cam fetch failed' }));
            }
        });
        proxyReq.on('timeout', () => {
            console.warn('[PROXY] Traffic cams request timed out');
            proxyReq.destroy();
        });
        proxyReq.end();
    } catch (err) {
        console.error('[PROXY] Traffic cams handler error:', err.message);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Internal proxy error' }));
        }
    }
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
                    HealthMonitor.recordAdsbPoll(true);
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
                    
                    HealthMonitor.updateAssetCount(filteredCount);

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
                    HealthMonitor.recordAdsbPoll(false);
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
        HealthMonitor.recordAdsbPoll(false);
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Timeout', message: 'Upstream ADS-B request timed out' }));
    });

    proxyReq.on('error', (err) => {
        HealthMonitor.recordAdsbPoll(false);
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
                HealthMonitor.setAisConnected(true);
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
                HealthMonitor.recordAisMessage();
                const payload = typeof event === 'string' ? event : event.toString();
                aisState.messages.push(payload);
                if (aisState.messages.length > MAX_AIS_MESSAGES) {
                    aisState.messages = aisState.messages.slice(-MAX_AIS_MESSAGES);
                }
                aisState.lastSeen = new Date().toISOString();
            });

            ws.on('error', () => {
                aisState.connected = false;
                HealthMonitor.setAisConnected(false);
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

// Health Check Endpoint
function getHealth(req, res) {
    const health = HealthMonitor.getHealth();
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(health));
}

// Performance Metrics Endpoint
function getMetrics(req, res) {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(HealthMonitor.getMetrics()));
}

// System Information Endpoint
function getInfo(req, res) {
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(HealthMonitor.getSystemInfo()));
}

// API Documentation Endpoint
function getDocs(req, res) {
    const docs = {
        title: 'SENTINEL OMEGA API',
        version: '1.0.0',
        description: 'Real-time geospatial intelligence dashboard API',
        endpoints: [
            { path: '/api/health', method: 'GET', description: 'System health check' },
            { path: '/api/metrics', method: 'GET', description: 'Real-time operational metrics' },
            { path: '/api/info', method: 'GET', description: 'Process and system information' },
            { path: '/api/status', method: 'GET', description: 'UI connectivity status' },
            { path: '/api/adsb-mil', method: 'GET', description: 'ADS-B military proxy' },
            { path: '/api/ais-poll', method: 'GET', description: 'AIS maritime telemetry relay' },
            { path: '/api/briefings-list', method: 'GET', description: 'List historical strategic reports' },
            { path: '/api/generate-briefing', method: 'POST', description: 'Manual briefing trigger' },
            { path: '/api/resolve-stream', method: 'GET', description: 'Resolve YouTube channel ID to current live video ID (param: channel)' }
        ]
    };
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(docs));
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
    // ── SECURITY HARDENING ──
    
    // Apply CORS
    corsHandler(req, res, () => {
        // Apply Helmet security headers
        helmetHandler(req, res, () => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                HealthMonitor.recordRequest(res.statusCode < 400);
                if (process.env.NODE_ENV !== 'test') {
                    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
                }
            });

            const url = req.url.split('?')[0];
            if (url.startsWith('/api/') && process.env.NODE_ENV !== 'development') {
                const limitErr = rateLimiter.checkLimit(req);
                if (limitErr) {
                    res.writeHead(limitErr.status, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*' 
                    });
                    res.end(JSON.stringify({ error: limitErr.message, retryAfter: limitErr.retryAfter }));
                    return;
                }
            }

            if (url === '/api/adsb-mil') return proxyAdsb(req, res);
            if (url === '/api/ais-poll') return pollAis(req, res);
            if (url === '/api/status') return getStatus(req, res);
            if (url === '/api/health') return getHealth(req, res);
            if (url === '/api/metrics') return getMetrics(req, res);
            if (url === '/api/info') return getInfo(req, res);
            if (url === '/api/docs') return getDocs(req, res);
            if (url === '/api/briefings') return getBriefings(req, res);
            if (url === '/api/generate-report') return generateReport(req, res);
            if (url === '/api/proximity-alert') return handleProximityAlert(req, res);
            if (url === '/api/traffic-cams') return proxyTrafficCams(req, res);
            if (url === '/api/resolve-stream') return resolveYouTubeStream(req, res);

            // Serve empty favicon to suppress browser 404
            if (url === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

            // ── SECURITY EXAMPLES ──
            if (url === '/api/admin/rotate-keys' && req.method === 'POST') {
                return requireAPIKey(req, res, () => {
                    try {
                        const result = SecretsManager.rotateAPIKey('client');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Keys rotated', info: result }));
                    } catch (e) {
                        res.writeHead(500); res.end(e.message);
                    }
                });
            }

            if (url === '/api/validate-target' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const sanitized = InputValidator.sanitizeFlightData(data);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ valid: true, sanitized }));
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ valid: false, error: e.message }));
                    }
                });
                return;
            }

            // ── BRIEFING ENDPOINTS ──
            if (url === '/api/generate-briefing' && req.method === 'POST') {
                briefingScheduler.generateBriefing()
                    .then(result => {
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify(result));
                    })
                    .catch(err => {
                        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    });
                return;
            }

            if (url === '/api/briefing/stats') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify(briefingScheduler.getStats()));
                return;
            }

            if (url === '/api/briefings-list') {
                const dir = path.join(ROOT, 'briefings');
                if (!fs.existsSync(dir)) {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ files: [] }));
                    return;
                }
                const files = fs.readdirSync(dir).filter(f => f.startsWith('briefing_')).sort().reverse();
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ count: files.length, files }));
                return;
            }

            if (url.startsWith('/api/briefing/download/')) {
                const filename = url.split('/').pop();
                const filepath = path.join(ROOT, 'briefings', filename);
                if (!fs.existsSync(filepath) || !filename.startsWith('briefing_')) {
                    res.writeHead(404); res.end('Not found'); return;
                }
                res.writeHead(200, { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' });
                fs.createReadStream(filepath).pipe(res);
                return;
            }

            // Serve config.js dynamically to inject server-side environment variables.
            // Note: CESIUM_ACCESS_TOKEN is intentionally exposed to the browser — CesiumJS
            // requires it client-side to access Cesium Ion resources. Ensure the token has
            // read-only / tile-access scope and appropriate domain restrictions on ion.cesium.com.
            if (url === '/config.js') {
                const cesiumToken = process.env.CESIUM_ACCESS_TOKEN || '';
                const configContent = [
                    `window.CESIUM_ACCESS_TOKEN = ${JSON.stringify(cesiumToken)};`,
                    `window.CONFIG = { API_BASE_URL: '/api' };`
                ].join('\n') + '\n';
                res.writeHead(200, {
                    'Content-Type': 'application/javascript',
                    'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff'
                });
                res.end(configContent);
                return;
            }

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
