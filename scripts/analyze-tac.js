import axios from 'axios';
import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TILE_SIZE = 256;
const TILE_BASE_URL = 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Terminal/MapServer/tile';

function project(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const rad = (val) => val * Math.PI / 180;
    const x = n * ((lng + 180) / 360);
    const y = n * (1 - (Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI)) / 2;
    return { x, y };
}

function unproject(x, y, zoom) {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    const lat = latRad * 180 / Math.PI;
    return { lat, lng };
}

async function analyzeRegion(lat, lng, radiusDeg = 1.0, zoom = 10) {
    console.log(`Final scan for Portland TAC (Radius ${radiusDeg}, Zoom ${zoom})...`);

    const topLeft = project(lat + radiusDeg, lng - radiusDeg, zoom);
    const bottomRight = project(lat - radiusDeg, lng + radiusDeg, zoom);
    const startX = Math.floor(topLeft.x), startY = Math.floor(topLeft.y);
    const endX = Math.ceil(bottomRight.x), endY = Math.ceil(bottomRight.y);
    const cols = endX - startX + 1, rows = endY - startY + 1;
    const width = cols * TILE_SIZE, height = rows * TILE_SIZE;

    const tilesToFetch = [];
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            tilesToFetch.push({ x, y });
        }
    }

    process.stdout.write(`Downloading tiles... `);
    const responses = await Promise.all(tilesToFetch.map(async (t) => {
        try {
            const url = `${TILE_BASE_URL}/${zoom}/${t.y}/${t.x}`;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return { ...t, data: response.data };
        } catch (e) { return { ...t, data: null }; }
    }));
    console.log('Done.');

    const compositeOps = responses.filter(r => r.data).map(res => ({
        input: res.data,
        top: (res.y - startY) * TILE_SIZE,
        left: (res.x - startX) * TILE_SIZE
    }));

    const fullImage = await sharp({
        create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } }
    }).composite(compositeOps).raw().toBuffer({ resolveWithObject: true });

    const { data } = fullImage;

    const isMapPixel = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a === 0) return false;
        const val = (r + g + b) / 3;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max > 0 ? (max - min) / max : 0;
        return (val < 235) && (sat > 0.02); // More inclusive for faint edges
    };

    const bSize = 2; // High precision
    const bCols = Math.ceil(width / bSize), bRows = Math.ceil(height / bSize);
    let blocks = new Uint8Array(bCols * bRows);
    for (let by = 0; by < bRows; by++) {
        for (let bx = 0; bx < bCols; bx++) {
            let mapPx = 0;
            for (let dy = 0; dy < bSize; dy++) {
                for (let dx = 0; dx < bSize; dx++) {
                    if (isMapPixel(bx * bSize + dx, by * bSize + dy)) mapPx++;
                }
            }
            if (mapPx > (bSize * bSize * 0.2)) blocks[by * bCols + bx] = 1;
        }
    }

    // GROW ISLAND
    let finalMask = new Uint8Array(bCols * bRows);
    let q = [];
    const midX = Math.floor(bCols / 2), midY = Math.floor(bRows / 2);
    // Find initial seed in the colorful center
    for (let d = 0; d < 500; d++) {
        const idx = (midY) * bCols + (midX);
        if (blocks[idx]) { finalMask[idx] = 1; q.push(idx); break; }
    }
    if (q.length === 0) { for (let i = 0; i < blocks.length; i++) { if (blocks[i]) { finalMask[i] = 1; q.push(i); break; } } }

    while (q.length > 0) {
        let curr = q.shift();
        let cx = curr % bCols, cy = Math.floor(curr / bCols);
        for (const n of [{ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 }]) {
            if (n.x >= 0 && n.x < bCols && n.y >= 0 && n.y < bRows) {
                const idx = n.y * bCols + n.x;
                if (blocks[idx] && !finalMask[idx]) { finalMask[idx] = 1; q.push(idx); }
            }
        }
    }

    let mapPixels = [];
    for (let i = 0; i < finalMask.length; i++) {
        if (finalMask[i]) {
            const bx = i % bCols, by = Math.floor(i / bCols);
            for (let dy = 0; dy < bSize; dy++) {
                for (let dx = 0; dx < bSize; dx++) {
                    const x = bx * bSize + dx, y = by * bSize + dy;
                    if (isMapPixel(x, y)) mapPixels.push({ x, y });
                }
            }
        }
    }

    if (mapPixels.length === 0) { console.error('Map island lost.'); return; }

    // CORNER DETECTION V4: Find points closest to the corners of the bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of mapPixels) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    let pNW = mapPixels[0], pNE = mapPixels[0], pSE = mapPixels[0], pSW = mapPixels[0];
    let dNW = Infinity, dNE = Infinity, dSE = Infinity, dSW = Infinity;

    for (const p of mapPixels) {
        // NW: closest to (minX, minY)
        const distNW = Math.pow(p.x - minX, 2) + Math.pow(p.y - minY, 2);
        if (distNW < dNW) { dNW = distNW; pNW = p; }
        // NE: closest to (maxX, minY)
        const distNE = Math.pow(p.x - maxX, 2) + Math.pow(p.y - minY, 2);
        if (distNE < dNE) { dNE = distNE; pNE = p; }
        // SE: closest to (maxX, maxY)
        const distSE = Math.pow(p.x - maxX, 2) + Math.pow(p.y - maxY, 2);
        if (distSE < dSE) { dSE = distSE; pSE = p; }
        // SW: closest to (minX, maxY)
        const distSW = Math.pow(p.x - minX, 2) + Math.pow(p.y - maxY, 2);
        if (distSW < dSW) { dSW = distSW; pSW = p; }
    }

    // REGULARIZATION: Ensure horizontal top and bottom borders
    const NW_geo = unproject(startX + pNW.x / TILE_SIZE, startY + pNW.y / TILE_SIZE, zoom);
    const NE_geo = unproject(startX + pNE.x / TILE_SIZE, startY + pNE.y / TILE_SIZE, zoom);
    const SE_geo = unproject(startX + pSE.x / TILE_SIZE, startY + pSE.y / TILE_SIZE, zoom);
    const SW_geo = unproject(startX + pSW.x / TILE_SIZE, startY + pSW.y / TILE_SIZE, zoom);

    // Top border latitude: Use the maximum (northernmost) of the two detected top corners
    const topLat = Math.max(NW_geo.lat, NE_geo.lat);
    // Bottom border latitude: Use the minimum (southernmost) of the two detected bottom corners
    const bottomLat = Math.min(SW_geo.lat, SE_geo.lat);

    // Right border longitude: Use the maximum (easternmost) of the two detected right corners
    const rightLng = Math.max(NE_geo.lng, SE_geo.lng);
    // Left border longitude: Use the minimum (westernmost) of the two detected left corners
    const leftLng = Math.min(NW_geo.lng, SW_geo.lng);

    const finalNW = NW_geo;
    const finalNE = NE_geo;
    const finalSE = SE_geo;
    const finalSW = SW_geo;

    console.log('\n--- FINAL PRECISION CORNERS (TRAPEZOIDAL) ---');
    console.log(`NW: [${finalNW.lat.toFixed(6)}, ${finalNW.lng.toFixed(6)}]`);
    console.log(`NE: [${finalNE.lat.toFixed(6)}, ${finalNE.lng.toFixed(6)}]`);
    console.log(`SE: [${finalSE.lat.toFixed(6)}, ${finalSE.lng.toFixed(6)}]`);
    console.log(`SW: [${finalSW.lat.toFixed(6)}, ${finalSW.lng.toFixed(6)}]`);

    // Verification Draw
    const drawNW = project(finalNW.lat, finalNW.lng, zoom);
    const drawNE = project(finalNE.lat, finalNE.lng, zoom);
    const drawSE = project(finalSE.lat, finalSE.lng, zoom);
    const drawSW = project(finalSW.lat, finalSW.lng, zoom);

    // Adjust pixel coordinates to be relative to the current image (startX, startY)
    drawNW.x = (drawNW.x - startX) * TILE_SIZE;
    drawNW.y = (drawNW.y - startY) * TILE_SIZE;
    drawNE.x = (drawNE.x - startX) * TILE_SIZE;
    drawNE.y = (drawNE.y - startY) * TILE_SIZE;
    drawSE.x = (drawSE.x - startX) * TILE_SIZE;
    drawSE.y = (drawSE.y - startY) * TILE_SIZE;
    drawSW.x = (drawSW.x - startX) * TILE_SIZE;
    drawSW.y = (drawSW.y - startY) * TILE_SIZE;

    const overlay = Buffer.alloc(width * height * 4, 0); // Initialize with transparent black
    const drawThickLine = (pp1, pp2, color = { r: 255, g: 0, b: 0 }, thickness = 5) => {
        const dx = Math.abs(pp2.x - pp1.x), dy = Math.abs(pp2.y - pp1.y);
        const sx = pp1.x < pp2.x ? 1 : -1, sy = pp1.y < pp2.y ? 1 : -1;
        let err = dx - dy, x = Math.round(pp1.x), y = Math.round(pp1.y);
        while (true) {
            const offset = Math.floor(thickness / 2);
            for (let ty = -offset; ty < thickness - offset; ty++) {
                for (let tx = -offset; tx < thickness - offset; tx++) {
                    const px = x + tx, py = y + ty;
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        const idx = (py * width + px) * 4;
                        overlay[idx] = color.r; overlay[idx + 1] = color.g; overlay[idx + 2] = color.b; overlay[idx + 3] = 255;
                    }
                }
            }
            if (x === Math.round(pp2.x) && y === Math.round(pp2.y)) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    };

    const red = { r: 255, g: 0, b: 0 };
    drawThickLine(drawNW, drawNE, red, 10);
    drawThickLine(drawNE, drawSE, red, 10);
    drawThickLine(drawSE, drawSW, red, 10);
    drawThickLine(drawSW, drawNW, red, 10);

    const outputPath = join(__dirname, '../debug-final-approval.png');
    await sharp(data, { raw: { width, height, channels: 4 } })
        .composite([{ input: overlay, raw: { width, height, channels: 4 } }])
        .png().toFile(outputPath);
    console.log(`\nFinal approval image saved to: ${outputPath}`);
}

const args = process.argv.slice(2);
let lat = 45.7, lng = -122.6, radius = 0.7, zoom = 11;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lat') lat = parseFloat(args[++i]);
    if (args[i] === '--lng') lng = parseFloat(args[++i]);
    if (args[i] === '--radius') radius = parseFloat(args[++i]);
    if (args[i] === '--zoom') zoom = parseInt(args[++i]);
}
analyzeRegion(lat, lng, radius, zoom).catch(console.error);
