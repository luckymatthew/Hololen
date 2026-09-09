import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0864 required Lui fan attachment',()=>{
 let s=state('hBP08-064');fund(s.players[0].zones.center,['無色']);const fan=cards.find(c=>c.jpName==='ルイ友'||c.name==='ルイ友');
 s.players[0].mainDeck=[inst(fan.number,'fan')];s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.attachments[0].id,'fan');
});
for(const pay of [true,false])test('0864 paid required damage '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-064');s.players[0].hand=[inst('AUDIT-DUMMY','cost')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,pay?30:0);
});
