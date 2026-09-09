import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const eligible of [true,false])test('Marine first-turn required Bloom search '+eligible,()=>{
 const target=cards.find(c=>c.jpName==='宝鐘マリン'&&['bloom','bloom_effect'].includes(c.keyword?.type));let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=eligible?1:2;s.players[0].zones.back1=unit('hEB01-012');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'pick')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);if(eligible){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);
});
test('Marine paid Arts required summer search',()=>{
 const target=cards.find(c=>c.jpName==='宝鐘マリン'&&c.tags.includes('#サマー'));let s=state('hEB01-011');fund(s.players[0].zones.center,['藍']);s.players[0].mainDeck=[inst(target.number,'pick')];s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');
});
