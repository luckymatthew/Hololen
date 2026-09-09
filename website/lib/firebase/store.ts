import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { firebaseConfigured, getFirebase, friendlyError } from './client';
import { clean, content, mergeDecision } from './merge.mjs';
import { fromHoloSimDeck, isHoloSimDeck } from '../holosim-deck.mjs';
import { validateDeckState } from '../deck-data';

export type DeckRecord = { id: string; name: string; deck: { oshi: Record<string, number>; main: Record<string, number>; cheer: Record<string, number>; printings?: Record<string, Record<string, number>> }; createdAt: number; updatedAt: number; schemaVersion: number; revision?: number; archived?: boolean; [key: string]: any };
type Bucket = 'decks' | 'data';
let uid: string | null = null;
let started = false;
let syncing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastPull = 0;
let settleSync: (() => void)[] = [];
export let syncStatus = '本機模式';
const key = (owner = uid, bucket: Bucket = 'decks') => `holo-account-v1:${owner || 'guest'}:${bucket}`;
export const currentOwner = () => uid;
export const draftKey = () => `holo-account-v1:${uid || 'guest'}:draft`;
function emit(status?: string) {
  if (status) syncStatus = status;
  window.dispatchEvent(new CustomEvent('holo-data-changed'));
}
function read(owner = uid, bucket: Bucket = 'decks'): DeckRecord[] {
  const raw = localStorage.getItem(key(owner, bucket));
  if (!raw) return [];
  try { const rows = JSON.parse(raw); if (!Array.isArray(rows)) throw new Error(); return rows; }
  catch { throw new Error('本機資料無法讀取。原始資料已保留，請先匯出備份再修復。'); }
}
function write(rows: DeckRecord[], owner = uid, bucket: Bucket = 'decks') {
  try { localStorage.setItem(key(owner, bucket), JSON.stringify(rows)); }
  catch { throw new Error('此裝置儲存空間不足；請立即匯出牌組備份。'); }
  emit();
}
export function listLocalDecks(includeArchived = false) { return read().filter(row => includeArchived || !row.archived); }
export function getLocalDeck(id: string) { return read().find(row => row.id === id); }
export function saveLocalDeck(input: Partial<DeckRecord> & Pick<DeckRecord, 'name' | 'deck'>) {
  const rows = read();
  const old = rows.find(row => row.id === input.id);
  const now = Date.now();
  const staleEditor = old && typeof input._editorBase === 'string' && input._editorBase !== content(old);
  if (staleEditor) rows.push({ ...clean(old), id: crypto.randomUUID(), name: `${old.name.slice(0, 44)}（衝突保留）`, conflictOf: old.id, archived: false, _dirty: true, _base: '', _change: crypto.randomUUID() } as DeckRecord);
  const row: DeckRecord = { ...old, ...input, id: input.id || crypto.randomUUID(), createdAt: old?.createdAt || input.createdAt || now, updatedAt: Math.max(now, old?.createdAt || 0), schemaVersion: 1, _dirty: true, _change: crypto.randomUUID(), _base: old?._base || '' };
  delete row._editorBase;
  write([...rows.filter(item => item.id !== row.id), row]);
  emit(uid ? '已存於本機，等待同步' : '已存於此裝置');
  scheduleSync();
  return row;
}
export function archiveDeck(id: string, archived = true) {
  const row = getLocalDeck(id); if (row) saveLocalDeck({ ...row, archived });
}
export function backupLocalData() {
  // Download the active account only. Never expose other browser profiles.
  return { schemaVersion: 1, decks: read().map(clean), data: read(uid, 'data').map(clean), draft: localStorage.getItem(draftKey()) };
}
export function importDecks(input: any) {
  const rows = Array.isArray(input) ? input : input?.decks || (isHoloSimDeck(input) ? [{ name: input.name || '匯入的 HoloSim 牌組', deck: fromHoloSimDeck(input) }] : input?.deck ? [input] : input?.oshi && input?.main && input?.cheer ? [{ name: '匯入牌組', deck: input }] : null);
  if (!Array.isArray(rows)) throw new Error('備份檔格式不正確。');
  for (const row of rows) {
    if (!validateDeckState(row.deck) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 60) throw new Error('備份包含無效牌組。');
  }
  const records = input?.data || [];
  if (!Array.isArray(records) || records.some((row: any) => !/^(settings|collection)(~[a-f0-9]{24})?$/.test(row.id) || !row.value || typeof row.value !== 'object' || Array.isArray(row.value))) throw new Error('備份包含無效帳號設定。');
  const draft = input?.draft ? JSON.parse(input.draft) : null;
  if (draft && !validateDeckState(draft)) throw new Error('備份包含無效草稿。');
  // Imported IDs never overwrite an unrelated existing record.
  for (const row of rows) {
    const same = read().find(item => content({ ...item, id: row.id }) === content(row));
    if (!same) saveLocalDeck({ ...clean(row), id: crypto.randomUUID() });
  }
  // Keep existing settings/collection and preserve imported variants alongside them.
  const data = read(uid, 'data');
  for (const record of records) {
    if (data.some(row => content(row) === content(record))) continue;
    const id = data.some(row => row.id === record.id) ? `${record.id.split('~')[0]}~${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}` : record.id;
    data.push({ ...clean(record), id, createdAt: Math.min(record.createdAt || Date.now(), Date.now()), updatedAt: Date.now(), schemaVersion: 1, _dirty: true, _base: '', _change: crypto.randomUUID() });
  }
  write(data, uid, 'data');
  if (draft) saveLocalDeck({ name: '備份中的草稿', deck: draft });
  scheduleSync();
}
export function importGuestDecks() {
  if (!uid) return;
  const guests = read(null);
  const rows = read();
  const additions = guests.filter(g => !rows.some(r => r.importedLocalId === g.id)).map(g => ({ ...g, id: crypto.randomUUID(), importedLocalId: g.id, _dirty: true, _base: '', _change: crypto.randomUUID() }));
  write([...rows, ...additions]); scheduleSync();
}
export function preserveLegacyDraft() {
  const raw = localStorage.getItem('hololive-ocg-deck-draft-v1');
  if (!raw || localStorage.getItem('holo-legacy-draft-imported-v1')) return;
  try {
    const deck = JSON.parse(raw);
    if (!deck.oshi || !deck.main || !deck.cheer || ![deck.oshi, deck.main, deck.cheer].some(s => Object.keys(s).length)) return;
    const oldUid = uid; uid = null;
    if (!localStorage.getItem(draftKey())) localStorage.setItem(draftKey(), raw);
    try { saveLocalDeck({ name: '遷移前草稿', deck }); localStorage.setItem('holo-legacy-draft-imported-v1', '1'); }
    finally { uid = oldUid; }
  } catch { emit('原有草稿已保留，請檢查或匯出備份。'); }
}
export function saveUserData(id: 'settings' | 'collection', value: Record<string, unknown>) {
  const rows = read(uid, 'data'), old = rows.find(row => row.id === id), now = Date.now();
  const row = { ...old, id, value, createdAt: old?.createdAt || now, updatedAt: now, schemaVersion: 1, _base: old?._base || '', _dirty: true, _change: crypto.randomUUID() } as unknown as DeckRecord;
  write([...rows.filter(item => item.id !== id), row], uid, 'data'); scheduleSync();
}
export function getUserData(id: string) { return read(uid, 'data').find(row => row.id === id)?.value; }
export function scheduleSync() { clearTimeout(timer); if (uid) timer = setTimeout(() => void syncNow(), 1500); }
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join(''); }
export async function syncNow(force = false): Promise<void> {
  if (syncing) { await new Promise<void>(resolve => settleSync.push(resolve)); return syncNow(force); }
  if (!uid || !navigator.onLine) return;
  const owner = uid;
  const { firestore, auth } = getFirebase();
  if (auth.currentUser?.uid !== owner || auth.currentUser.isAnonymous) return;
  syncing = true; emit('正在同步…');
  let conflicts = 0;
  try {
    for (const bucket of ['decks', 'data'] as Bucket[]) {
      // Read on login / explicit refresh / focus at most once per minute.
      if (force || Date.now() - lastPull > 60_000) {
        const snapshot = await getDocs(collection(firestore, 'users', owner, bucket));
        if (uid !== owner) return;
        const rows = read(owner, bucket);
        for (const item of snapshot.docs) {
          const remote = { ...item.data(), id: item.id } as DeckRecord;
          const at = rows.findIndex(row => row.id === remote.id);
          if (at < 0) rows.push({ ...remote, _base: content(remote), _dirty: false });
          else if (!rows[at]._dirty) rows[at] = { ...remote, _base: content(remote), _dirty: false };
        }
        write(rows, owner, bucket);
      }
      for (const local of read(owner, bucket).filter(row => row._dirty)) {
        if (uid !== owner || auth.currentUser?.uid !== owner) return;
        const reference = doc(firestore, 'users', owner, bucket, local.id);
        const localHash = await digest(content(local));
        const result = await runTransaction(firestore, async transaction => {
          const snapshot = await transaction.get(reference);
          const remote = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as DeckRecord : null;
          const decision = mergeDecision(local, remote);
          let fork: DeckRecord | null = null;
          if (decision.conflict) {
            const hash = decision.conflict === local ? localHash : await digest(content(decision.conflict));
            const preserved = { ...clean(decision.conflict), id: `${local.id.split('~')[0]}~${hash.slice(0, 24)}`, conflictOf: local.id, archived: false, schemaVersion: 1 } as DeckRecord;
            if (bucket === 'decks') preserved.name = `${preserved.name.slice(0, 44)}（衝突保留）`;
            transaction.set(doc(firestore, 'users', owner, bucket, preserved.id), preserved);
            fork = preserved;
          }
          const winner = clean(decision.winner) as DeckRecord;
          if (decision.upload) { winner.revision = (remote?.revision || 0) + 1; transaction.set(reference, winner); }
          return { winner, fork };
        });
        if (uid !== owner) return;
        const rows = read(owner, bucket), at = rows.findIndex(row => row.id === local.id);
        // Do not replace a newer local edit that happened while the write was in flight.
        if (at >= 0 && rows[at]._change === local._change) rows[at] = { ...result.winner, _base: content(result.winner), _dirty: false };
        else if (at >= 0) rows[at]._base = content(result.winner);
        if (result.fork) {
          conflicts++;
          const fork = result.fork;
          if (!rows.some(row => row.id === fork.id)) rows.push({ ...fork, _base: content(fork), _dirty: false });
        }
        write(rows, owner, bucket);
      }
    }
    lastPull = Date.now();
    emit(conflicts ? '同步完成；不同版本已保留，請檢查衝突牌組。' : '已與雲端同步');
  } catch (error) { if (uid === owner) emit(friendlyError(error)); }
  finally {
    syncing = false;
    settleSync.splice(0).forEach(resolve => resolve());
    // A dirty record remains durable on failure. Retry on save, explicit sync,
    // reconnection or focus, without an unbounded quota-consuming retry loop.
  }
}
export async function readyForDecks() {
  if (!firebaseConfigured) return;
  await getFirebase().auth.authStateReady();
  // A cached local library is immediately usable even if the cloud is down.
  if (listLocalDecks().length) return;
  await Promise.race([syncNow(), new Promise(resolve => setTimeout(resolve, 6000))]);
}
export function startSync() {
  if (started) return; started = true;
  preserveLegacyDraft();
  window.addEventListener('storage', event => { if (event.key?.startsWith('holo-account-v1:')) { emit(); scheduleSync(); } });
  window.addEventListener('online', () => void syncNow(true));
  window.addEventListener('offline', () => emit('離線中，變更會保留於本機'));
  window.addEventListener('focus', () => void syncNow());
  if (firebaseConfigured) onAuthStateChanged(getFirebase().auth, user => {
    uid = user && !user.isAnonymous ? user.uid : null; lastPull = 0;
    window.dispatchEvent(new CustomEvent('holo-owner-changed'));
    emit(uid ? '正在載入你的雲端牌組…' : '本機模式');
    void syncNow(true);
  });
}
