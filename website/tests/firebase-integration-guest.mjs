import { readFileSync } from 'node:fs';
const data = new Map();
globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
globalThis.window = new EventTarget();
Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, init) => url === '/cards.json' ? Promise.resolve(Response.json(JSON.parse(readFileSync('public/cards.json', 'utf8')))) : nativeFetch(url, init);
const app = await import('../work/firebase-integration-client.mjs');
const code = process.argv[2], deck = JSON.parse(readFileSync('tests/fixtures/starter-deck.json', 'utf8'));
try {
  let room = await app.joinRoom(code, { name: 'Guest test', deck });
  app.watchRoom(code, next => { room = next; }, () => {});
  process.send({ event: 'joined' });
  process.on('message', async message => {
    try {
      if (message.command === 'ready') { room = await app.loadRoom(code); room = await app.sendRoomAction(code, { expectedVersion: room.version, action: { type: 'ready', ready: true } }); process.send({ event: 'ready' }); }
      if (message.command === 'verify') { room = await app.loadRoom(code); if (room.state.status !== 'setup' || !room.state.players[0].hand.every(card => card === null)) throw new Error('Guest view leaked host hand'); process.send({ event: 'verified' }); }
      if (message.command === 'setup') { room = await app.loadRoom(code); room = await app.sendRoomAction(code, { expectedVersion: room.version, action: { type: 'setup', centerId: room.state.players[1].hand[0].id, backIds: [], bottomIds: [] } }); process.send({ event: 'setup' }); }
      if (message.command === 'cheer') { room = await app.loadRoom(code); room = await app.sendRoomAction(code, { expectedVersion: room.version, action: { type: 'choose', zone: 'center' } }); process.send({ event: 'cheer' }); }
    } catch (error) { process.send({ error: String(error) }); }
  });
} catch (error) { process.send({ error: String(error) }); process.exit(1); }
