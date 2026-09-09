import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'firebase', envDir: '..', publicDir: '../public',
    resolve: { alias: { '@': resolve('.'), 'next/link': resolve('firebase/Link.tsx') } },
    define: { 'import.meta.env.VITE_APP_BACKEND': JSON.stringify('firebase') },
    plugins: [react(), { name: 'firebase-shell', closeBundle() {
      const dir = resolve('dist-firebase');
      const html = readFileSync(resolve(dir, 'index.html'), 'utf8');
      const version = createHash('sha256').update(html).update(readFileSync('public/cards.json')).digest('hex').slice(0, 16);
      const assets = readdirSync(resolve(dir, 'assets')).filter(file => /\.(js|css)$/.test(file) && !/^(SimulatorClient|pvp)-/.test(file)).map(file => `/assets/${file}`);
      writeFileSync(resolve(dir, 'sw.js'), readFileSync('firebase/sw-template.js', 'utf8').replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(assets)));
      if (env.VITE_FIREBASE_EMULATORS === 'true') writeFileSync(resolve(dir, 'EMULATOR-ONLY.txt'), 'Do not deploy this build.');
    } }],
    server: { host: '127.0.0.1', port: 5173, fs: { allow: [resolve('.')] } },
    preview: { host: '127.0.0.1', port: 4173 },
    build: { outDir: '../dist-firebase', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1500 },
  };
});
