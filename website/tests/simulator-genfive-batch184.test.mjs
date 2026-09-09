import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const [first,turns] of [[1,1],[0,1],[1,2]])test('0777 required generation-five search '+first+turns,()=>{
 let s=state();s.phase='main';s.firstPlayer=first;s.players[0].turnsTaken=turns;s.players[0].zones.back1=unit('hBP07-077');
 const pick=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&c.tags.includes('#5期生'));
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(pick.number,'pick'),inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(first===1&&turns===1){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'pick');}
 else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,0);}
});
