import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../ios/Sources/bridge.js',import.meta.url),'utf8');
function bridge(cloud=async()=>({status:200,body:'{"ok":true}'})) {
  const calls=[];
  const window={location:new URL('holo://localhost/app/index.html'),crypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)},webkit:{messageHandlers:{native:{postMessage:b=>calls.push(b)},cloud:{postMessage:cloud}}},fetch:async (...args)=>{calls.push(args);return new Response('local');}};
  window.window=window;Object.assign(window,{URL,Request,Response,Uint8Array,Promise,Error,DOMException});
  vm.runInNewContext(source,window);return {window,calls};
}
test('iOS forwards account JSON requests and preserves HTTP errors',async()=>{
  let sent;const {window}=bridge(async b=>{sent=b;return {status:401,body:'{"error":"登入失效"}'}});
  const result=await window.fetch('/api/auth/login',{method:'POST',body:'{"email":"example@example.test"}'});
  assert.equal(result.status,401);assert.deepEqual(await result.json(),{error:'登入失效'});
  assert.equal(sent.method,'POST');assert.equal(sent.path,'/api/auth/login');assert.equal(sent.body,'{"email":"example@example.test"}');
});
test('bundled card files bypass cloud requests',async()=>{
  const {window,calls}=bridge(()=>{throw new Error('must not call cloud')});
  assert.equal(await (await window.fetch('/cards.json')).text(),'local');assert.equal(calls.length,1);
});
test('original image routes retain the exact card URL and local thumbs',()=>{
  const {window}=bridge();const url='https://hololive-official-cardgame.com/wp-content/images/cardlist/hBP01/hBP01-060_SR.png';
  const routed=new URL(window.HoloNative.artUrl(url));assert.equal(routed.protocol,'holo:');assert.equal(routed.searchParams.get('url'),url);
  assert.equal(window.HoloNative.artUrl('/card-art/abc.webp'),'/card-art/abc.webp');assert.equal(window.HoloNative.artUrl('https://example.test/other.png'),'https://example.test/other.png');
});
test('aborted cloud request fails immediately without sending',async()=>{
  const {window}=bridge(()=>{throw new Error('should not send')});const signal=AbortSignal.abort();
  await assert.rejects(window.fetch('/api/decks',{signal}),e=>e.name==='AbortError');
});
test('no-content delete responses and secure local deck IDs work',async()=>{
  const {window}=bridge(async()=>({status:204,body:''}));const result=await window.fetch('/api/decks/example',{method:'DELETE'});
  assert.equal(result.status,204);assert.equal(await result.text(),'');
  const a=window.crypto.randomUUID(),b=window.crypto.randomUUID();assert.match(a,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.notEqual(a,b);
});
test('scanner and file operations keep the Android event contract',()=>{
  const {window,calls}=bridge();window.HoloNative.startScanner();window.HoloNative.importJson();window.HoloNative.exportJson('deck.json','{"main":{}}');
  assert.deepEqual(calls.map(b=>b.action),['scan','import','export']);assert.equal(calls[2].name,'deck.json');assert.equal(calls[2].json,'{"main":{}}');
});
