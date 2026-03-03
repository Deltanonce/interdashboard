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
});
