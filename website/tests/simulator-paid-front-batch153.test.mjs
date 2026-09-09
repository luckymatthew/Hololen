import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP06-043','hBP06-046'])for(const pay of [true,false])test(n+' pay '+pay,()=>{
 let s=state(n==='hBP06-046'?n:'AUDIT-DUMMY');
 const c=cards.find(c=>c.group==='holomem'&&c.tags.includes('#Promise'));s.players[0].hand=[inst(c.number,'a')];if(n==='hBP06-046')s.players[0].hand.push(inst('AUDIT-DUMMY','b'));
 if(n==='hBP06-043'){s.phase='main';s.players[0].zones.back1=unit(n);s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
 else{s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='鷹嶺ルイ').number);fund(s.players[0].zones.center,['紅','無色','無色']);s=applyAction(s,0,attack,pool,()=>0);}
 assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,pay?{type:'choose',cardIds:n==='hBP06-043'?['a']:['a','b']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,(n==='hBP06-046'?120:0)+(pay?(n==='hBP06-046'?50:30):0));assert.equal(s.pendingChoice,null);
});
