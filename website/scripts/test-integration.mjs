import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const env = Object.fromEntries(readFileSync('.env.emulator', 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
mkdirSync('work', { recursive: true });
await build({ entryPoints: ['tests/firebase-integration-entry.ts'], outfile: 'work/firebase-integration-client.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { 'import.meta.env': JSON.stringify(env) } });
const result = spawnSync(process.execPath, ['--test', '--test-force-exit', 'tests/firebase-integration.test.mjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
