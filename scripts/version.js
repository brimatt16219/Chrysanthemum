import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version   = Date.now().toString();

// Write for the browser to fetch
writeFileSync(
  join(__dirname, '..', 'public', 'version.json'),
  JSON.stringify({ version })
);

// Write for vite.config.ts to read
writeFileSync(
  join(__dirname, '..', '.build-version'),
  version
);

console.log('version written:', version);