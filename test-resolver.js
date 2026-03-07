#!/usr/bin/env node
// Comprehensive test — tries many well-known 24/7 live YouTube channels
// Run: node test-resolver.js

const http = require('http');

const channels = [
    // ── CONFIRMED WORKING ──
    { id: 'UCNye-wNBqNL5ZzHSJj3l8Bg', name: 'Al Jazeera English' },

    // ── MIDDLE EAST NEWS ──
    { id: 'UC7fWeaHhqgM4Lba4tRzMHgw', name: 'TRT World' },
    { id: 'UCbyxxGFNGas9lKdRXnWzWMw', name: 'Al Arabiya English' },
    { id: 'UCKh1xoml5h-LPOHA68XiNJQ', name: 'i24NEWS' },
    { id: 'UCaQ1ztGBIFYJB3hDYsNb_6w', name: 'Al Jazeera Arabic' },

    // ── INTERNATIONAL NEWS 24/7 ──
    { id: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', name: 'France 24 English' },
    { id: 'UCknLrEdhRCp1aegoMqRaCZg', name: 'DW News' },
    { id: 'UCoMdktPbSTixAyNGwb-UYkQ', name: 'Sky News' },
    { id: 'UCW2QcKZiU8aUGg4yxCIditg', name: 'euronews' },
    { id: 'UC_gUM8rL-Lrg6O3adPW9K1g', name: 'WION' },
    { id: 'UCBi2mrWuNuyYy4gbM6fU18Q', name: 'ABC News Live' },
    { id: 'UCeY0bbntWzzVIaj2z3QigXg', name: 'NBC News' },
    { id: 'UC8p1vwvWtl6T73JiExfWs1g', name: 'CBS News' },
    { id: 'UCo8bcnLyZH8tBIH9V1mLgqQ', name: 'CNA' },
    { id: 'UCi-UmAIbVEOfpUNTv0pVh9g', name: 'NHK World' },
    { id: 'UCL_qhgtOy0dy1Agp8vkySQg', name: 'Arirang' },
    { id: 'UC6RJ7-PaXg6TIH2BzZfTV7w', name: 'India Today' },
    { id: 'UCHk0cUvl_JJynByMIPOHRcg', name: 'NDTV 24x7' },

    // ── WEBCAMS & MISC ──
    { id: 'UC0SWnPlRv3aRFwVt3Y3bUkQ', name: 'Quran TV Makkah' },
    { id: 'UCkBGZmmFEOauMlAW-YRfU5A', name: 'EarthTV Istanbul' },
    { id: 'UCfzl01jvJxwp4MqY3tdsKvA', name: 'LiveU (conflict cams)' },
];

async function testChannel(ch) {
    return new Promise((resolve) => {
        const url = `http://127.0.0.1:8888/api/resolve-stream?channel=${ch.id}`;
        const req = http.get(url, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const status = data.videoId ? '✓ LIVE' : '✗ OFF ';
                    const src = data.source || 'cached';
                    console.log(`  ${status} | ${ch.name.padEnd(22)} | ${ch.id} → ${data.videoId || 'null'} [${src}]`);
                    resolve(data);
                } catch (e) {
                    console.log(`  ✗ ERR  | ${ch.name.padEnd(22)} | Parse error: ${body.substring(0, 80)}`);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => {
            console.log(`  ✗ ERR  | ${ch.name.padEnd(22)} | ${e.message}`);
            resolve(null);
        });
        req.setTimeout(30000, () => {
            req.destroy();
            console.log(`  ✗ TIME | ${ch.name.padEnd(22)} | Timeout`);
            resolve(null);
        });
    });
}

(async () => {
    console.log('\n🔍 Testing YouTube Stream Resolver — Comprehensive Scan');
    console.log('━'.repeat(95));
    
    for (const ch of channels) {
        await testChannel(ch);
    }
    
    console.log('━'.repeat(95));
    console.log('Copy-paste all ✓ LIVE results back to me and I will assign them to cameras.\n');
})();
