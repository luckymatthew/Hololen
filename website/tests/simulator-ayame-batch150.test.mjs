import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const kind of ['arts','collab'])for(const pay of [true,false])test('038 '+kind+' pay '+pay,()=>{
 let s=state(kind==='arts'?'hBP06-038':'AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY03-001','cost')];s.players[0].archive=[inst('hBP06-038','return')];
 if(kind==='arts'){fund(s.players[0].zones.center,['紅']);s=applyAction(s,0,attack,pool,()=>0);}
 else{s.phase='main';s.players[0].zones.back1=unit('hBP06-038');s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
 assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,pay?{type:'choose',optionId:s.pendingChoice.modeOptions[0].id}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,kind==='arts'?{type:'choose',zone:'center'}:{type:'choose',cardIds:['return']},pool,()=>0);}
 assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);assert.equal(s.pendingChoice,null);
 if(kind==='arts')assert.equal(s.players[1].zones.center.damage,pay?50:30);else assert.equal(s.players[0].hand.length,pay?1:0);
});
