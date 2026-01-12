import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(__dirname, '../public');
const TARGET_FILE = path.join(TARGET_DIR, 'airports.csv');
const SOURCE_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

console.log(`Downloading airport data from ${SOURCE_URL}...`);

const file = fs.createWriteStream(TARGET_FILE);

https.get(SOURCE_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error(`Failed to download: ${response.statusCode} ${response.statusMessage}`);
        response.resume();
        return;
    }

    response.pipe(file);

    file.on('finish', () => {
        file.close();
        console.log(`Data saved to ${TARGET_FILE}`);
    });
}).on('error', (err) => {
    fs.unlink(TARGET_FILE, () => { }); // Delete partial file
    console.error(`Error downloading file: ${err.message}`);
});
