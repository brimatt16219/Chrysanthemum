import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import tailwindcss from '@tailwindcss/vite';

const versionPath = join(process.cwd(), '.build-version');
const version     = existsSync(versionPath)
  ? readFileSync(versionPath, 'utf-8').trim()
  : 'dev';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});