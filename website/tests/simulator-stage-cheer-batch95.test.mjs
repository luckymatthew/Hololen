import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const count of [0,1,2])test('082 printed optional transfer count '+count,()=>{
 const card=cards.find(c=>c.number==='hBP03-082');let s=state(cards.find(c=>c.jpName===card.jpName&&c.stage==='1st').number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom')];s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst('hY01-001','a'),inst('hY02-001','b'),inst('hY03-001','c')]});
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});assert.equal(s.pendingChoice.optional,true);
 if(count===0)s=act(s,{type:'choose',skip:true});
 else {s=act(s,{type:'choose',cheerId:'a'});s=act(s,count===1?{type:'choose',skip:true}:{type:'choose',cheerId:'b'});}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.cheer.length,count);assert.equal(s.players[0].zones.back1.cheer.length,3-count);
});
