import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('0848 optional cheer cost required search '+pay,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-048');s.players[0].zones.center.cheer=[inst('hY01-001','cost')];
 const c=cards.find(c=>c.jpName==='けはい'||c.name==='けはい');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(c.number,'pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,pay?{type:'choose',zone:'center',cheerId:'cost'}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,pay?1:0);assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);
});
