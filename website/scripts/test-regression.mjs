import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = readdirSync('tests').filter(name => name.endsWith('.test.mjs') && !name.startsWith('firebase-') && !['rendered-html.test.mjs', 'releases.test.mjs'].includes(name)).map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
