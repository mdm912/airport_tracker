import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execPromise = util.promisify(exec);

const TACS = [
    { id: 'ANCHORAGE', name: 'Anchorage TAC', lat: 61.17, lng: -149.99, radius: 1.5 },
    { id: 'ATLANTA', name: 'Atlanta TAC', lat: 33.64, lng: -84.42, radius: 1.5 },
    { id: 'BALTIMORE_WASHINGTON', name: 'Baltimore/Washington TAC', lat: 38.85, lng: -77.04, radius: 1.5 },
    { id: 'BOSTON', name: 'Boston TAC', lat: 42.36, lng: -71.00, radius: 1.5 },
    { id: 'CHARLOTTE', name: 'Charlotte TAC', lat: 35.21, lng: -80.94, radius: 1.5 },
    { id: 'CHICAGO', name: 'Chicago TAC', lat: 41.97, lng: -87.90, radius: 1.5 },
    { id: 'CINCINNATI', name: 'Cincinnati TAC', lat: 39.04, lng: -84.66, radius: 1.5 },
    { id: 'CLEVELAND', name: 'Cleveland TAC', lat: 41.41, lng: -81.84, radius: 1.5 },
    { id: 'DALLAS_FT_WORTH', name: 'Dallas/Ft. Worth TAC', lat: 32.89, lng: -97.04, radius: 1.5 },
    { id: 'DENVER_COLORADO_SPRINGS', name: 'Denver/Colorado Springs TAC', lat: 39.85, lng: -104.67, radius: 2.0 },
    { id: 'DETROIT', name: 'Detroit TAC', lat: 42.21, lng: -83.35, radius: 1.5 },
    { id: 'HONOLULU', name: 'Honolulu TAC', lat: 21.31, lng: -157.92, radius: 1.5 },
    { id: 'HOUSTON', name: 'Houston TAC', lat: 29.98, lng: -95.33, radius: 1.5 },
    { id: 'KANSAS_CITY', name: 'Kansas City TAC', lat: 39.29, lng: -94.71, radius: 1.5 },
    { id: 'LAS_VEGAS', name: 'Las Vegas TAC', lat: 36.08, lng: -115.15, radius: 1.5 },
    { id: 'LOS_ANGELES', name: 'Los Angeles TAC', lat: 33.94, lng: -118.40, radius: 1.5 },
    { id: 'MEMPHIS', name: 'Memphis TAC', lat: 35.04, lng: -89.97, radius: 1.5 },
    { id: 'MIAMI', name: 'Miami TAC', lat: 25.79, lng: -80.28, radius: 1.5 },
    { id: 'MINNEAPOLIS_ST_PAUL', name: 'Minneapolis/St. Paul TAC', lat: 44.88, lng: -93.22, radius: 1.5 },
    { id: 'NEW_ORLEANS', name: 'New Orleans TAC', lat: 29.99, lng: -90.25, radius: 1.5 },
    { id: 'NEW_YORK', name: 'New York TAC', lat: 40.64, lng: -73.77, radius: 1.5 },
    { id: 'PHILADELPHIA', name: 'Philadelphia TAC', lat: 39.87, lng: -75.24, radius: 1.5 },
    { id: 'PHOENIX', name: 'Phoenix TAC', lat: 33.43, lng: -112.00, radius: 1.5 },
    { id: 'PITTSBURGH', name: 'Pittsburgh TAC', lat: 40.49, lng: -80.23, radius: 1.5 },
    { id: 'PUERTO_RICO', name: 'Puerto Rico/Virgin Islands TAC', lat: 18.43, lng: -66.00, radius: 1.5 },
    { id: 'SALT_LAKE_CITY', name: 'Salt Lake City TAC', lat: 40.78, lng: -111.97, radius: 1.5 },
    { id: 'SAN_DIEGO', name: 'San Diego TAC', lat: 32.73, lng: -117.19, radius: 1.5 },
    { id: 'SAN_FRANCISCO', name: 'San Francisco TAC', lat: 37.61, lng: -122.37, radius: 1.5 },
    { id: 'ST_LOUIS', name: 'St. Louis TAC', lat: 38.74, lng: -90.36, radius: 1.5 },
    { id: 'TAMPA_ORLANDO', name: 'Tampa/Orlando TAC', lat: 28.1, lng: -82.0, radius: 2.0 },
];

const results = [];

console.log(`Starting batch extraction for ${TACS.length} TACs...`);

async function processTac(tac) {
    console.log(`Processing ${tac.name}...`);
    try {
        const { stdout: out } = await execPromise(`node scripts/analyze-tac.js --lat ${tac.lat} --lng ${tac.lng} --radius ${tac.radius} --zoom 10`);

        // Parse the NW, NE, SE, SW coords
        const nwMatch = out.match(/NW:\s*\[([-\d.]+),\s*([-\d.]+)\]/);
        const neMatch = out.match(/NE:\s*\[([-\d.]+),\s*([-\d.]+)\]/);
        const seMatch = out.match(/SE:\s*\[([-\d.]+),\s*([-\d.]+)\]/);
        const swMatch = out.match(/SW:\s*\[([-\d.]+),\s*([-\d.]+)\]/);

        if (nwMatch && neMatch && seMatch && swMatch) {
            const polygon = [
                [parseFloat(nwMatch[1]), parseFloat(nwMatch[2])],
                [parseFloat(neMatch[1]), parseFloat(neMatch[2])],
                [parseFloat(seMatch[1]), parseFloat(seMatch[2])],
                [parseFloat(swMatch[1]), parseFloat(swMatch[2])]
            ];

            const bounds = [
                [parseFloat(swMatch[1]), parseFloat(nwMatch[2])], // rough SW
                [parseFloat(neMatch[1]), parseFloat(seMatch[2])]  // rough NE
            ];

            results.push({
                id: tac.id,
                name: tac.name,
                bounds,
                polygon
            });
            console.log(`  Success! NW: ${polygon[0]}`);
        } else {
            console.log(`  Failed to find coordinates in output for ${tac.name}`);
        }
    } catch (err) {
        console.error(`  Error running script for ${tac.name}: ${err.message}`);
    }
}

// Concurrency limit helper
async function processAll() {
    const concurrency = 6;
    for (let i = 0; i < TACS.length; i += concurrency) {
        const chunk = TACS.slice(i, i + concurrency);
        await Promise.all(chunk.map(tac => processTac(tac)));
    }

    // Write to tacBounds.ts
    let tsContent = "import L from 'leaflet';\n\n";
    tsContent += "export interface TacChart {\n  id: string;\n  name: string;\n  bounds: L.LatLngBoundsExpression;\n  polygon: L.LatLngExpression[];\n}\n\n";
    tsContent += "export const TAC_CHARTS: TacChart[] = [\n";

    // Add PDX and SEA manually since they were specifically calibrated, along with new ones
    const existing = [
        {
            id: 'PORTLAND',
            name: 'Portland TAC',
            bounds: [[45.195103, -123.191757], [46.016516, -122.067719]],
            polygon: [[46.016039, -123.191757], [46.016516, -122.067719], [45.200425, -122.075958], [45.195103, -123.184204]],
        },
        {
            id: 'SEATTLE',
            name: 'Seattle TAC',
            bounds: [[46.750212, -123.196564], [48.060643, -121.530762]],
            polygon: [[48.059725, -123.196564], [48.060643, -121.530762], [46.750212, -121.551361], [46.751153, -123.182831]],
        }
    ];

    const allTacs = [...existing, ...results];

    for (const tac of allTacs) {
        tsContent += `  {\n`;
        tsContent += `    id: '${tac.id}',\n`;
        tsContent += `    name: '${tac.name}',\n`;
        tsContent += `    bounds: [\n      [${tac.bounds[0][0]}, ${tac.bounds[0][1]}],\n      [${tac.bounds[1][0]}, ${tac.bounds[1][1]}]\n    ],\n`;
        tsContent += `    polygon: [\n`;
        for (const p of tac.polygon) {
            tsContent += `      [${p[0]}, ${p[1]}],\n`;
        }
        tsContent += `    ],\n`;
        tsContent += `  },\n`;
    }
    tsContent += "];\n";

    fs.writeFileSync('src/data/tacBounds.ts', tsContent);
    console.log('Finished writing to src/data/tacBounds.ts');
}

processAll();
