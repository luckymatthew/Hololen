import { firebaseBuild } from './firebase/client';
// The existing Sites endpoints remain available in the original build. Only the
// Firebase SPA uses this adapter; there is no fake /api rewrite on static Hosting.
export async function appFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!firebaseBuild || !input.startsWith('/api/')) return fetch(input, init);
  try {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const method = init?.method || 'GET';
    if (input.startsWith('/api/decks')) {
      const store = await import('./firebase/store');
      const id = decodeURIComponent(input.split('/')[3] || '');
      if (method === 'GET') await store.readyForDecks();
      if (method === 'GET' && !id) return Response.json({ decks: store.listLocalDecks() });
      if (method === 'GET') { const deck = store.getLocalDeck(id); return Response.json(deck ? { deck } : { error: '找不到這副牌組；請先到我的牌組同步。' }, { status: deck ? 200 : 404 }); }
      if (method === 'DELETE') { store.archiveDeck(id); return Response.json({ ok: true }); }
      const { validateDeckName, validateDeckState } = await import('./deck-data');
      if (!validateDeckName(body.name) || !validateDeckState(body.deck)) throw new Error('牌組名稱或內容格式不正確。');
      return Response.json({ deck: store.saveLocalDeck({ ...body, id: id || undefined }) });
    }
    if (input.startsWith('/api/simulator/rooms')) {
      const pvp = await import('./firebase/pvp');
      const [, , , , code, operation] = input.split('/');
      if (!code) return Response.json(await pvp.createRoom(body));
      if (operation === 'join') return Response.json(await pvp.joinRoom(code, body));
      if (operation === 'actions') return Response.json(await pvp.sendRoomAction(code, body));
      return Response.json(await pvp.loadRoom(code));
    }
    return Response.json({ error: '這個功能請由帳號頁面開啟。' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error && !(error as { code?: string }).code ? error.message : (await import('./firebase/client')).friendlyError(error);
    return Response.json({ error: message }, { status: /狀態已更新/.test(message) ? 409 : 400 });
  }
}
