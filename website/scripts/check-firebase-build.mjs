import { validateMobileCardUpdate } from '../lib/mobile-card-update.mjs';
import { validateEmbeddedDisplayTranslations } from './embed-display-translations.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertTranslationArtifactMatchesSource } from './validate-card-translations.mjs';
assertTranslationArtifactMatchesSource();
if (existsSync('dist-firebase/EMULATOR-ONLY.txt')) throw new Error('Refusing to deploy an emulator build.');
const html = readFileSync('dist-firebase/index.html', 'utf8');
if (!html.includes('/assets/')) throw new Error('Missing application bundle.');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]); }
const files = walk('dist-firebase');
if (files.some(f => /\.(apk|aab|jks|keystore|pem)$/.test(f))) throw new Error('Hosting must not contain APKs or private signing material.');
const env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
for (const field of ['API_KEY', 'APP_ID', 'DATABASE_URL']) if (!new RegExp(`VITE_FIREBASE_${field}=.+`).test(env) && !process.env[`VITE_FIREBASE_${field}`]) throw new Error(`Set VITE_FIREBASE_${field} before deploying.`);
console.log('Firebase build validated. No APKs, signing keys or server runtime included.');

validateEmbeddedDisplayTranslations({ directory: 'public' });
validateEmbeddedDisplayTranslations({ directory: 'dist-firebase' });

for (const directory of ['public', 'dist-firebase']) validateMobileCardUpdate({ log: JSON.parse(readFileSync(`${directory}/website-updates.json`, 'utf8')), catalogBytes: readFileSync(`${directory}/cards.json`) });
if (!readFileSync('public/website-updates.json').equals(readFileSync('dist-firebase/website-updates.json'))) throw new Error('Built mobile update log does not match tested source bytes.');
