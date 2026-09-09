import { get, ref, set, onValue, onDisconnect, runTransaction, serverTimestamp } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { getFirebase } from './client';
import { applyAction, createLobbyState, joinLobby, publicRoomState, validateBattleDeck } from '../simulator/engine.mjs';
import { runAiStep } from '../simulator/ai.mjs';

const TTL = 36 * 60 * 60 * 1000;
let cardsPromise: Promise<any[]>;
async function cards() { return cardsPromise ??= fetch('/cards.json').then(r => { if (!r.ok) throw new Error('卡庫讀取失敗。'); return r.json(); }).then(p => p.cards); }
async function identity() {
  const { auth } = getFirebase(); await auth.authStateReady();
  return auth.currentUser || (await signInAnonymously(auth)).user;
}
function codeCheck(code: string) { if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error('請輸入正確的 6 位房間碼。'); }
function playerCheck(name: string, deck: any, catalog: any[]) {
  if (!name?.trim() || name.trim().length > 24) throw new Error('玩家名稱需要 1–24 個字。');
  const valid = validateBattleDeck(deck, catalog); if (!valid.ok) throw new Error(valid.error);
}
function view(room: any, uid: string) { return { code: room.metadata.code, version: room.metadata.version, viewerIndex: uid === room.metadata.hostUid ? 0 : 1, state: publicRoomState(JSON.parse(room.stateJson), uid === room.metadata.hostUid ? 0 : 1) }; }
function publishViews(room: any) {
  room.views = { [room.metadata.hostUid]: JSON.stringify(view(room, room.metadata.hostUid)) };
  if (room.metadata.guestUid) room.views[room.metadata.guestUid] = JSON.stringify(view(room, room.metadata.guestUid));
  return room;
}
const soloKey = (code: string) => `holo-solo-v1:${code}`;
export const isSolo = (code: string) => code.startsWith('AI-');
export async function createRoom(payload: any) {
  const catalog = await cards(); playerCheck(payload.name, payload.deck, catalog);
  if (payload.singlePlayer) {
    playerCheck('AI', payload.opponentDeck || payload.deck, catalog);
    let state: any = createLobbyState(payload.name.trim(), payload.deck);
    state = joinLobby(state, 'AIこより · EXPERT', payload.opponentDeck || payload.deck);
    state.mode = 'solo'; state.aiPlayer = 1;
    state = applyAction(state, 0, { type: 'ready', ready: true }, catalog);
    state = applyAction(state, 1, { type: 'ready', ready: true }, catalog);
    const code = `AI-${crypto.randomUUID().toUpperCase()}`;
    const room = { code, version: 1, state }; localStorage.setItem(soloKey(code), JSON.stringify(room));
    return { ...room, state: publicRoomState(state, 0), viewerIndex: 0, token: 'local-solo' };
  }
  const user = await identity(), { database } = getFirebase();
  await cleanupOwnedRooms().catch(() => {});
  for (let attempt = 0; attempt < 8; attempt++) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('');
    const now = Date.now();
    const room = publishViews({ metadata: { code, hostUid: user.uid, guestUid: '', version: 1, status: 'lobby', createdAt: now, updatedAt: now, expiresAt: now + TTL }, stateJson: JSON.stringify(createLobbyState(payload.name.trim(), payload.deck)) });
    const result = await runTransaction(ref(database, `rooms/${code}`), current => current === null ? room : undefined, { applyLocally: false });
    if (result.committed) {
      const own = JSON.parse(localStorage.getItem('holo-owned-rooms-v1') || '[]');
      localStorage.setItem('holo-owned-rooms-v1', JSON.stringify([...own.filter((r: any) => r.uid !== user.uid || r.expiresAt > now), { code, uid: user.uid, expiresAt: now + TTL }].slice(-50)));
      return { ...view(room, user.uid), token: user.uid };
    }
  }
  throw new Error('未能建立房間，請稍後重試。');
}
export async function joinRoom(code: string, payload: any) {
  codeCheck(code);
  const catalog = await cards(); playerCheck(payload.name, payload.deck, catalog);
  const user = await identity(), { database } = getFirebase();
  const snapshot = await get(ref(database, `rooms/${code}/metadata`)), meta = snapshot.val();
  if (!meta || meta.expiresAt <= Date.now()) throw new Error('找不到房間，或房間已過期。');
  if (meta.hostUid === user.uid || meta.guestUid === user.uid) return { ...await loadRoom(code), token: user.uid };
  if (meta.guestUid) throw new Error('房間已有兩位玩家。');
  const request = { uid: user.uid, name: payload.name.trim(), deckJson: JSON.stringify(payload.deck) };
  const joined = await runTransaction(ref(database, `rooms/${code}/join`), current => !current || current.uid === user.uid ? request : undefined, { applyLocally: false });
  if (!joined.committed) throw new Error('另一位玩家正在加入房間。');
  const result = await waitValue(`rooms/${code}/views/${user.uid}`, value => typeof value === 'string');
  return { ...JSON.parse(result), token: user.uid };
}
function waitValue(path: string, accept: (value: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('等待房主回應逾時，請確認房主保持對局頁面開啟。')); }, 20_000);
    const stop = onValue(ref(getFirebase().database, path), snapshot => { if (accept(snapshot.val())) { clearTimeout(timeout); stop(); resolve(snapshot.val()); } }, () => { clearTimeout(timeout); stop(); reject(new Error('房間連線失敗，請重新加入。')); });
  });
}
export async function loadRoom(code: string) {
  if (isSolo(code)) {
    const raw = localStorage.getItem(soloKey(code)); if (!raw) throw new Error('找不到此裝置的單人對局。');
    const room = JSON.parse(raw); return { ...room, state: publicRoomState(room.state, 0), viewerIndex: 0 };
  }
  codeCheck(code); const user = await identity();
  const snapshot = await get(ref(getFirebase().database, `rooms/${code}/views/${user.uid}`));
  if (!snapshot.exists()) throw new Error('房間不存在或已過期，請重新加入。');
  return JSON.parse(snapshot.val());
}
export async function sendRoomAction(code: string, payload: any) {
  if (isSolo(code)) {
    const room = JSON.parse(localStorage.getItem(soloKey(code)) || 'null');
    if (!room) throw new Error('找不到單人對局。');
    if (room.version !== payload.expectedVersion) throw new Error('房間狀態已更新，請重試。');
    const catalog = await cards();
    const state = payload.action.type === 'aiStep' ? runAiStep(room.state, catalog, 1) : applyAction(room.state, 0, payload.action, catalog);
    const next = { ...room, version: room.version + 1, state }; localStorage.setItem(soloKey(code), JSON.stringify(next));
    return { ...next, state: publicRoomState(state, 0), viewerIndex: 0 };
  }
  codeCheck(code); const user = await identity(), id = crypto.randomUUID();
  await set(ref(getFirebase().database, `rooms/${code}/commands/${user.uid}`), { id, expectedVersion: payload.expectedVersion, actionJson: JSON.stringify(payload.action) });
  const result = JSON.parse(await waitValue(`rooms/${code}/results/${user.uid}`, value => typeof value === 'string' && JSON.parse(value).id === id));
  if (result.error) throw new Error(result.error);
  return loadRoom(code);
}
export function watchRoom(code: string, onRoom: (room: any) => void, onStatus: (message: string) => void) {
  if (isSolo(code)) return () => {};
  let disposed = false, processing = false, again = false;
  const stops: (() => void)[] = [];
  let presencePath: string;
  void (async () => {
    const user = await identity(), { database } = getFirebase(), catalog = await cards();
    if (disposed) return;
    const metadata = (await get(ref(database, `rooms/${code}/metadata`))).val();
    if (!metadata) throw new Error('房間已不存在。');
    if (disposed) return;
    presencePath = `rooms/${code}/presence/${user.uid}`;
    stops.push(onValue(ref(database, '.info/connected'), async snapshot => {
      if (!snapshot.val()) { onStatus('連線中斷，正在嘗試重新連接…'); return; }
      try {
        await onDisconnect(ref(database, presencePath)).set({ online: false, updatedAt: serverTimestamp() });
        if (!disposed) await set(ref(database, presencePath), { online: true, updatedAt: serverTimestamp() });
      } catch { if (!disposed) onStatus('房間連線暫時無法恢復，請重新加入。'); }
    }));
    stops.push(onValue(ref(database, `rooms/${code}/presence`), snapshot => {
      const opponent = Object.entries(snapshot.val() || {}).find(([id]) => id !== user.uid)?.[1] as { online?: boolean } | undefined;
      if (opponent?.online === false) onStatus('對手已離線；保留此頁，等待重新連線。');
    }, () => {}));
    stops.push(onValue(ref(database, `rooms/${code}/views/${user.uid}`), snapshot => {
      if (snapshot.exists()) onRoom(JSON.parse(snapshot.val())); else onStatus('房間已關閉或過期。');
    }, () => onStatus('房間已過期或無法存取，請重新加入。')));
    if (metadata.hostUid !== user.uid) return;
    const root = ref(database, `rooms/${code}`);
    async function process() {
      if (disposed) return;
      if (processing) { again = true; return; }
      processing = true;
      try {
        await runTransaction(root, room => {
          if (!room || room.metadata.expiresAt <= Date.now()) return;
          let changed = false;
          if (room.join && !room.metadata.guestUid) {
            try {
              const deck = JSON.parse(room.join.deckJson); playerCheck(room.join.name, deck, catalog);
              room.stateJson = JSON.stringify(joinLobby(JSON.parse(room.stateJson), room.join.name, deck));
              room.metadata.guestUid = room.join.uid; room.join = null;
              room.metadata.version++; changed = true;
            } catch { room.join = null; changed = true; }
          }
          for (const [actor, command] of Object.entries(room.commands || {}) as [string, any][]) {
            if (actor !== room.metadata.hostUid && actor !== room.metadata.guestUid) continue;
            if (room.results?.[actor] && JSON.parse(room.results[actor]).id === command.id) continue;
            let error = '';
            try {
              if (command.expectedVersion !== room.metadata.version) throw new Error('房間狀態已更新，請在同步後重試。');
              const action = JSON.parse(command.actionJson);
              if (action.type === 'aiStep') throw new Error('私人對局不支援 AI 步驟。');
              room.stateJson = JSON.stringify(applyAction(JSON.parse(room.stateJson), actor === room.metadata.hostUid ? 0 : 1, action, catalog));
              room.metadata.version++;
            } catch (caught) { error = caught instanceof Error ? caught.message.slice(0, 300) : '操作失敗。'; }
            room.results ??= {}; room.results[actor] = JSON.stringify({ id: command.id, error }); changed = true;
          }
          if (!changed) return;
          room.metadata.updatedAt = Date.now(); room.metadata.status = JSON.parse(room.stateJson).status;
          return publishViews(room);
        }, { applyLocally: false });
      } catch { if (!disposed) onStatus('同步暫停，正在等待重新連線。'); }
      finally { processing = false; if (again) { again = false; void process(); } }
    }
    stops.push(onValue(root, () => { void process(); }, () => onStatus('房間已關閉或過期。')));
  })().catch(error => { if (!disposed) onStatus(error instanceof Error ? error.message : '無法連接房間。'); });
  return () => { disposed = true; stops.forEach(stop => stop()); if (presencePath) void set(ref(getFirebase().database, presencePath), { online: false, updatedAt: serverTimestamp() }).catch(() => {}); };
}
export async function cleanupOwnedRooms() {
  const user = await identity(), { database } = getFirebase();
  const rooms = JSON.parse(localStorage.getItem('holo-owned-rooms-v1') || '[]');
  for (const room of rooms) if (room.uid === user.uid && room.expiresAt < Date.now()) await set(ref(database, `rooms/${room.code}`), null);
  localStorage.setItem('holo-owned-rooms-v1', JSON.stringify(rooms.filter((r: any) => r.uid !== user.uid || r.expiresAt >= Date.now())));
}
