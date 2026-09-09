import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
if (existsSync('dist-firebase/EMULATOR-ONLY.txt')) throw new Error('Refusing to deploy an emulator build.');
const html = readFileSync('dist-firebase/index.html', 'utf8');
if (!html.includes('/assets/')) throw new Error('Missing application bundle.');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]); }
const files = walk('dist-firebase');
if (files.some(f => /\.(apk|aab|jks|keystore|pem)$/.test(f))) throw new Error('Hosting must not contain APKs or private signing material.');
const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
for (const field of ['API_KEY', 'APP_ID', 'DATABASE_URL']) if (!new RegExp(`VITE_FIREBASE_${field}=.+`).test(env) && !process.env[`VITE_FIREBASE_${field}`]) throw new Error(`Set VITE_FIREBASE_${field} before deploying.`);
console.log('Firebase build validated. No APKs, signing keys or server runtime included.');
