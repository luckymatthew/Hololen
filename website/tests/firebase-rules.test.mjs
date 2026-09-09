import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
let env;
const now = Date.now();
const room = () => ({ metadata: { code: 'ABCDEF', hostUid: 'host', guestUid: '', version: 1, status: 'waiting', createdAt: now, updatedAt: now, expiresAt: now + 60000 }, stateJson: '{}', views: { host: '{}' } });
const deck = { id: 'deck-a', name: 'Test', deck: { oshi: {}, main: {}, cheer: {}, printings: {} }, createdAt: now, updatedAt: now, schemaVersion: 1 };
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-holo-ocg', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }, database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 } }); });
after(async () => { await env?.cleanup(); });
const user = id => env.authenticatedContext(id, { firebase: { sign_in_provider: 'google.com' } });
test('Firestore private deck owner can save, another user and anonymous clients cannot read', async () => {
  const own = user('alice').firestore().doc('users/alice/decks/deck-a');
  await assertSucceeds(own.set(deck)); await assertSucceeds(own.get());
  await assertFails(user('bob').firestore().doc('users/alice/decks/deck-a').get());
  await assertFails(env.unauthenticatedContext().firestore().doc('users/alice/decks/deck-a').get());
  await assertFails(user('bob').firestore().doc('users/alice/decks/deck-a').set(deck));
  await assertFails(own.delete());
});
test('Firestore rejects malformed decks, path mismatch and future timestamps', async () => {
  const own = user('alice').firestore().doc('users/alice/decks/deck-a');
  await assertFails(own.set({ ...deck, id: 'wrong' }));
  await assertFails(own.set({ ...deck, deck: {} }));
  await assertFails(own.set({ ...deck, updatedAt: now + 1000000 }));
});
test('settings and collections are private and anonymous room accounts cannot create persistent account data', async () => {
  const ref = user('alice').firestore().doc('users/alice/data/settings');
  const data = { id: 'settings', schemaVersion: 1, value: { theme: 'dark' }, createdAt: now, updatedAt: now };
  await assertSucceeds(ref.set(data)); await assertFails(user('bob').firestore().doc('users/alice/data/settings').get());
  await assertFails(env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore().doc('users/anon/decks/deck-a').set(deck));
});
test('RTDB private room root and hidden state cannot be read by guests or unrelated users', async () => {
  const host = user('host').database(), guest = user('guest').database();
  await assertSucceeds(host.ref('rooms/ABCDEF').set(room()));
  await assertSucceeds(host.ref('rooms/ABCDEF').get());
  await assertFails(guest.ref('rooms').get()); await assertFails(guest.ref('rooms/ABCDEF').get());
  await assertFails(guest.ref('rooms/ABCDEF/stateJson').get());
  await assertSucceeds(guest.ref('rooms/ABCDEF/metadata').get());
  await assertFails(guest.ref('rooms/ABCDEF/metadata/hostUid').set('guest'));
  await assertFails(host.ref('rooms/ABCDEF/metadata/hostUid').set('guest'));
});
test('guest can reserve a join slot but cannot forge another uid or read a rivals deck', async () => {
  const guest = user('guest').database(), outsider = user('outsider').database();
  await assertFails(guest.ref('rooms/ABCDEF/join').set({ uid: 'forged', name: 'Guest', deckJson: '{}' }));
  await assertSucceeds(guest.ref('rooms/ABCDEF/join').set({ uid: 'guest', name: 'Guest', deckJson: '{}' }));
  await assertFails(outsider.ref('rooms/ABCDEF/join').get());
  await assertFails(outsider.ref('rooms/ABCDEF/join').set({ uid: 'outsider', name: 'Steal slot', deckJson: '{}' }));
});
test('room host publishes participant-scoped views; guest can only submit own current-version command', async () => {
  const host = user('host').database(), guest = user('guest').database(), outsider = user('outsider').database();
  await assertSucceeds(host.ref('rooms/ABCDEF').update({ 'metadata/guestUid': 'guest', 'views/guest': '{"hand":["private-card"]}', join: null }));
  await assertSucceeds(guest.ref('rooms/ABCDEF/views/guest').get());
  await assertFails(outsider.ref('rooms/ABCDEF/views/guest').get());
  await assertFails(guest.ref('rooms/ABCDEF/views/host').get());
  const command = { id: 'action-1', expectedVersion: 1, actionJson: '{"type":"ready","ready":true}' };
  await assertSucceeds(guest.ref('rooms/ABCDEF/commands/guest').set(command));
  await assertFails(guest.ref('rooms/ABCDEF/commands/host').set(command));
  await assertFails(outsider.ref('rooms/ABCDEF/commands/outsider').set(command));
  await assertFails(guest.ref('rooms/ABCDEF/commands/guest').set({ ...command, expectedVersion: 8 }));
  await assertFails(guest.ref('rooms/ABCDEF/stateJson').set('{}'));
  await assertSucceeds(host.ref('rooms/ABCDEF/metadata/version').set(2));
});
test('presence is writable only by its participant; expired rooms reject guest access and host can clean up', async () => {
  await assertSucceeds(user('guest').database().ref('rooms/ABCDEF/presence/guest').set({ online: false, updatedAt: now }));
  await assertFails(user('guest').database().ref('rooms/ABCDEF/presence/host').set({ online: false, updatedAt: now }));
  await env.withSecurityRulesDisabled(async context => context.database().ref('rooms/ABCDEF/metadata/expiresAt').set(now - 1000));
  await assertFails(user('guest').database().ref('rooms/ABCDEF/views/guest').get());
  await assertSucceeds(user('host').database().ref('rooms/ABCDEF').set(null));
  assert.equal((await user('host').database().ref('rooms/ABCDEF').get()).exists(), false);
});
