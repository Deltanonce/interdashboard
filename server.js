const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

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

function proxyAdsb(req, res) {
    const options = {
        hostname: 'api.adsb.lol',
        path: '/v2/mil',
        method: 'GET',
        timeout: 8000,
        headers: { 'User-Agent': 'IntelDashboard/4.0' }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let data = [];
        proxyRes.on('data', chunk => data.push(chunk));
        proxyRes.on('end', () => {
            const body = Buffer.concat(data);
            res.writeHead(proxyRes.statusCode || 502, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(body);
        });
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error('Upstream timeout'));
    });

    proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Proxy error');
    });

    proxyReq.end();
}

function resolveSafePath(urlPath) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(urlPath);
    } catch {
        return null;
    }
    const relativePath = decodedPath.replace(/^\/+/, '');
    const requestedPath = relativePath === '' ? 'index.html' : relativePath;
    const absolutePath = path.resolve(ROOT, requestedPath);

    if (!absolutePath.startsWith(path.resolve(ROOT) + path.sep) && absolutePath !== path.resolve(ROOT, 'index.html')) {
        return null;
    }

    return absolutePath;
}

const server = http.createServer((req, res) => {
    const requestPath = (req.url || '').split('?')[0];

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method not allowed');
        return;
    }

    if (requestPath === '/api/adsb-mil') {
        return proxyAdsb(req, res);
    }

    const filePath = resolveSafePath(requestPath);
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`SERVER_READY on http://localhost:${PORT}/`);
    console.log(`ADS-B Proxy: http://localhost:${PORT}/api/adsb-mil`);
});
