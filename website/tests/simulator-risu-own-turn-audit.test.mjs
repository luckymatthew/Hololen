import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const member=cards.find(c=>c.group==='holomem'&&c.tags.includes('#ID1期生')).number;
for(const owner of [0,1])test('Risu knockout owner '+owner,()=>{
 const s=state();s.players[owner].oshi=inst('hBP03-008');s.players[owner].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[owner].zones.back1=unit(member,{damage:10000});
 s.players[owner].mainDeck=[inst('AUDIT-DUMMY','draw'),inst('AUDIT-DUMMY','tail')];
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'test'}];
 let e=applyAction(s,0,attack,pool,()=>.5);assert.equal(e.pendingChoice.meta.trigger,'risuDraw');
 e=applyAction(e,owner,{type:'choose',optionId:'use'},pool,()=>.5);
 assert.equal(e.players[owner].hand[0].id,'draw');assert.equal(e.players[owner].holoPower.length,0);assert.equal(e.players[owner].oshiSkillTurn,e.turn);
});
