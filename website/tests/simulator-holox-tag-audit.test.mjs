import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const good=cards.find(c=>c.tags?.includes('#秘密結社holoX')&&c.stage==='2nd');
const lower=cards.find(c=>c.tags?.includes('#秘密結社holoX')&&c.stage==='1st');
const bad=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&!c.tags.includes('#秘密結社holoX'));
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup(){const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP02-036');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(good.number,'good'),inst(lower.number,'lower'),inst(bad.number,'wrong'),inst('AUDIT-DUMMY','tail')];return act(s,{type:'collab',zone:'back1'});}
test('lowercase holoX text selects canonical-tag 2nd only',()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'genericTopLook');assert.deepEqual(s.pendingChoice.selectableIds,['good']);
 assert.throws(()=>act(s,{type:'choose',cardIds:['wrong']}));assert.throws(()=>act(s,{type:'choose',cardIds:['lower']}));
 s=act(s,{type:'choose',cardIds:['good']});assert.equal(s.players[0].hand[0].id,'good');
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:['wrong','lower']});assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','wrong','lower']);
});
test('holoX conditional private look may decline and order all remaining',()=>{
 let s=act(setup(),{type:'choose',skip:true});s=act(s,{type:'choose',cardIds:['wrong','lower','good']});
 assert.equal(s.players[0].hand.length,0);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail','wrong','lower','good']);
});
