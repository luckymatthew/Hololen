import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = await realpath(path.resolve(fileURLToPath(new URL('../../', import.meta.url))));
const port = Number(process.env.EFFECT_AUDIT_PORT || 5181);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
]);

function allowed(relative) {
  const forwardSlashPath = relative.split(path.sep).join('/');
  return forwardSlashPath === 'public/cards.json'
    || forwardSlashPath.startsWith('tests/browser/')
    || forwardSlashPath.startsWith('lib/simulator/');
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    const relative = pathname === '/cards.json'
      ? path.join('public', 'cards.json')
      : path.normalize(pathname.replace(/^[/\\]+/, ''));
    if (!allowed(relative) || relative.startsWith('..')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const target = await realpath(path.resolve(websiteRoot, relative));
    if (!target.startsWith(`${websiteRoot}${path.sep}`)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const bytes = await readFile(target);
    response.writeHead(200, { 'Content-Type': types.get(path.extname(target)) || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Effect-audit harness: http://127.0.0.1:${port}/tests/browser/`));
