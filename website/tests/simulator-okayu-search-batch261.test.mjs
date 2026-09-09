import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('Required mascot fan search Okayu center '+valid,()=>{
 const okayu=cards.find(c=>c.jpName==='猫又おかゆ'&&c.group==='holomem'),fan=cards.find(c=>c.typeCode==='supportFan');let s=state(valid?okayu.number:'AUDIT-DUMMY');s.phase='main';s.players[0].zones.back1=unit('hSD03-010');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(fan.number,'pick')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);if(valid){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'pick');}else assert.equal(s.pendingChoice,null);
});
