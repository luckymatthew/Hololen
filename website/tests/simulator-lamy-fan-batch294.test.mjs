import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const attached of [true,false])test('Lamy required Yukimin search gate '+attached,()=>{const fan=cards.find(c=>c.jpName==='雪民');let s=state('hBP04-044');s.phase='main';s.players[0].zones.back1=unit('hBP04-044');if(attached)s.players[0].zones.center.attachments=[inst(fan.number,'old')];s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(fan.number,'yes')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);if(attached){assert.equal(s.pendingChoice,null);return;}assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);assert.equal(s.players[0].zones.collab.attachments[0].id,'yes');});
