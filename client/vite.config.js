import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Emits /sw.js from src/sw.js with the build's precache list and a content
 * hash baked in, so every deploy produces a new service worker and cache.
 */
function serviceWorker() {
  const publicFiles = (dir, base = '') =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? publicFiles(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`],
    );
  return {
    name: 'disciplex-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const pub = publicFiles(path.join(here, 'public')).filter((f) => !f.startsWith('.'));
      const urls = ['/', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...pub].map((f) => (f === '/' ? f : `/${f}`));
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) hash.update(name).update(chunk.code ?? chunk.source ?? '');
      for (const f of pub) hash.update(fs.readFileSync(path.join(here, 'public', f)));
      const source = fs
        .readFileSync(path.join(here, 'src', 'sw.js'), 'utf8')
        .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE_URLS__', JSON.stringify([...new Set(urls)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
