import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('052 mandatory back-row special damage preserves life on DOWN',()=>{
 const card=cards.find(c=>c.number==='hBP04-052');let s=state(cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut').number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom')];s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:9980});
 const act=a=>{s=applyAction(s,0,a,pool,()=>0)};act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);act({type:'choose',zone:'back1'});assert.equal(s.players[1].zones.back1,null);assert.equal(s.players[1].life.length,5);
});
