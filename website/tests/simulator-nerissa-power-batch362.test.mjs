import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const enabled of [true,false])test('Nerissa Collab hand to power '+enabled,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-076');if(enabled)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='ネリッサ・レイヴンクロフト').number);
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(!enabled){assert.equal(s.players[0].hand.length,0);return;}assert.equal(s.players[0].hand.length,1);assert.equal(s.pendingChoice.effect,'giftHandToPower');assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));const id=s.players[0].hand[0].id;s=applyAction(s,0,{type:'choose',cardIds:[id]},pool,()=>0);assert.equal(s.players[0].hand.length,0);assert.ok(s.players[0].holoPower.some(c=>c.id===id));
});
test('Nerissa Buzz loses exactly two life',()=>{let s=state('AUDIT-DUMMY','hBP07-076');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP07-076').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);});
