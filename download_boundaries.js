const fs = require('fs');
const https = require('https');

const regions = [
    // SE Asia
    'IDN', 'MYS', 'SGP', 'THA', 'VNM', 'PHL', 'BRN', 'KHM', 'MMR', 'LAO', 'TLS',
    // Middle East
    'IRN', 'IRQ', 'ISR', 'SAU', 'SYR', 'LBN', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT', 'JOR', 'TUR', 'EGY',
    // South Asia
    'IND', 'PAK', 'AFG', 'BGD', 'LKA', 'NPL', 'BTN', 'MDV'
];

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchJson(res.headers.location));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('Failed to parse JSON from', url);
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    let features = [];
    for (const iso of regions) {
        process.stdout.write(`Fetching ${iso}... `);
        try {
            const apiRes = await fetchJson(`https://www.geoboundaries.org/api/current/gbOpen/${iso}/ADM0/`);
            let geojsonUrl = null;
            if (Array.isArray(apiRes) && apiRes.length > 0 && apiRes[0].simplifiedGeometryGeoJSON) {
                geojsonUrl = apiRes[0].simplifiedGeometryGeoJSON;
            } else if (apiRes && apiRes.simplifiedGeometryGeoJSON) {
                geojsonUrl = apiRes.simplifiedGeometryGeoJSON;
            }

            if (geojsonUrl) {
                const geojson = await fetchJson(geojsonUrl);
                if (geojson && geojson.features) {
                    features.push(...geojson.features);
                    console.log('OK');
                } else if (geojson && geojson.type === 'Feature') {
                    features.push(geojson);
                    console.log('OK');
                } else if (geojson && geojson.type === 'FeatureCollection') {
                    features.push(...geojson.features);
                    console.log('OK');
                } else {
                    console.log('No geometry found');
                }
            } else {
                console.log('No simplifiedGeometryGeoJSON found');
            }
        } catch (e) {
            console.error('Error', e.message);
        }
    }

    const fc = {
        type: "FeatureCollection",
        features: features
    };

    fs.writeFileSync('assets/boundaries/regional-boundaries.geojson', JSON.stringify(fc));
    console.log('All boundaries saved into assets/boundaries/regional-boundaries.geojson');
}

run();
