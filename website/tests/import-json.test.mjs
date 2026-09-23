import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readImportJson} from '../lib/import-json.mjs';
const file=text=>({size:Buffer.byteLength(text),text:async()=>text});
test('Android deck envelope, printings and BOM survive importer unchanged',async()=>{
 const deck={name:'こより',deck:{oshi:{'hBP01-001':1},main:{'hBP09-001':4},cheer:{'hY01-001':20},printings:{'hBP09-001':{'printing-1':4}}}};
 assert.deepEqual(await readImportJson(file('\uFEFF'+JSON.stringify(deck))),deck);
});
test('empty, truncated, wrong reports and oversize files give actionable failures before mutation',async()=>{
 for(const text of ['', '  ', '\uFEFF'])await assert.rejects(readImportJson(file(text)),/空白/);
 await assert.rejects(readImportJson(file('{"deck":')),/不完整/);
 await assert.rejects(readImportJson(file('null')),/物件/);
 await assert.rejects(readImportJson(file('{"schemaVersion":"hololens.ai-review.v1"}')),/診斷/);
 await assert.rejects(readImportJson({size:21*1024*1024,text(){throw Error('must not read');}}),/20 MB/);
});
