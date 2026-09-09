import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
for(const attached of [true,false])test('Ayame Poyo attached gate '+attached,()=>{
 const poyo=cards.find(c=>c.jpName==='ぽよ余');assert.ok(poyo);let s=state();s.phase='main';s.players[0].zones.back1=unit('hSD02-004',{attachments:attached?[inst(poyo.number)]:[]});s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s.phase='performance';s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,attached?120:100);
});
