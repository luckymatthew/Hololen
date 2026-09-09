import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0764 mandatory pioneer attachment '+available,()=>{
 let s=state('hBP07-064');fund(s.players[0].zones.center,['無色']);s.players[0].zones.back1=unit('AUDIT-DUMMY');
 const fan=cards.find(c=>c.name==='開拓者'||c.jpName==='開拓者');
 s.players[0].mainDeck=available?[inst(fan.number,'fan'),inst('AUDIT-DUMMY','other')]:[inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(available){
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);
 assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.attachments.at(-1).id,'fan');
 }else assert.equal(s.pendingChoice,null);
});
