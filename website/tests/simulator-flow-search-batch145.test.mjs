import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const timing of ['eligible','first','later'])test('016 search '+timing,()=>{
 let s=state();s.phase='main';s.firstPlayer=timing==='first'?0:1;s.players[0].turnsTaken=timing==='later'?2:1;s.players[0].zones.back1=unit('hBP06-016');
 const valid=cards.find(c=>c.group==='holomem'&&c.tags.includes('#FLOW GLOW')&&c.keyword?.type==='collab_effect');
 const invalid=cards.find(c=>c.group==='holomem'&&c.tags.includes('#FLOW GLOW')&&!c.keyword);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(valid.number,'valid'),inst(invalid.number,'invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(timing==='eligible'){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,timing==='eligible'?1:0);assert.equal(s.pendingChoice,null);
});
