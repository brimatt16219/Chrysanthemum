import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'public', 'version.json');
writeFileSync(outputPath, JSON.stringify({ version: Date.now().toString() }));

console.log('version.json written:', outputPath);