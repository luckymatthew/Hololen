import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const oshi of ['hBP02-004','hBD24-016'])for(const used of [true,false])test('056 SP '+oshi+' used '+used,()=>{
 const s=state('hBP06-056');s.players[0].oshi=inst(oshi);s.players[0].spOshiSkillUsed=used;fund(s.players[0].zones.center,['藍','藍','無色']);
 const act=()=>applyAction(s,0,attack,pool,()=>0);
 if(oshi==='hBP02-004'&&used){const r=act();assert.ok(r.players[1].zones.center.damage>=120);}else assert.throws(act);
});

test('hBP06-056 reveals six cards, counts Holomen, then archives every revealed card',()=>{
 const s=state('hBP06-056');
 fund(s.players[0].zones.center,['藍','藍','無色','無色']);
 s.players[0].mainDeck=[
  inst('hBP01-009','reveal-holomen-1'),
  inst('hBP01-010','reveal-holomen-2'),
  inst('hBP01-011','reveal-holomen-3'),
  inst('hBP01-102','reveal-support-1'),
  inst('hBP01-103','reveal-support-2'),
  inst('hBP01-104','reveal-support-3'),
 ];
 const r=applyAction(s,0,attack,pool,()=>0);
 assert.equal(r.players[1].zones.center.damage,180);
 assert.deepEqual(r.players[0].archive.map(card=>card.id),[
  'reveal-holomen-1','reveal-holomen-2','reveal-holomen-3',
  'reveal-support-1','reveal-support-2','reveal-support-3',
 ]);
 assert.equal(r.players[0].mainDeck.length,0);
 assert.equal(r.players[0].turnEvents.deckArchived,6);
});
