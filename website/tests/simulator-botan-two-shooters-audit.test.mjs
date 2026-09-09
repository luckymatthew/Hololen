import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
test('Botan distributes green Cheer to two different back Shooters',()=>{
 const lower=cards.find(c=>c.jpName==='獅白ぼたん'&&c.stage==='1st'),shooter=cards.find(c=>c.group==='holomem'&&c.tags.includes('#シューター')&&!c.colors.includes('綠'));
 assert.ok(shooter);const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP03-021','bloom')];
 s.players[0].zones.back1=unit(shooter.number);s.players[0].zones.back2=unit(shooter.number);
 s.players[0].archive=[inst('hY02-001','a'),inst('hY02-001','b'),inst('hY01-001','white')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['a','b']);assert.equal(e.pendingChoice.max,2);
 e=act(e,{type:'choose',cardIds:['a','b']});e=act(e,{type:'choose',zone:'back1'});
 assert.throws(()=>act(e,{type:'choose',zone:'back1'}));e=act(e,{type:'choose',zone:'back2'});
 assert.equal(e.players[0].zones.back1.cheer[0].id,'a');assert.equal(e.players[0].zones.back2.cheer[0].id,'b');assert.equal(e.players[0].archive[0].id,'white');
});
