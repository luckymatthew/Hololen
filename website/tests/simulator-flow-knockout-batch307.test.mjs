import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const flow=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#FLOW GLOW'));
const custom=[...pool.filter(c=>c.number!==flow.number),{...flow,arts:[{...dummy.arts[0],damage:0}]}];
for(const [zone,deck,expected] of [['center',5,true],['center',6,false],['back2',5,false]])test(`FLOW GLOW special knockout ${zone} deck ${deck}`,()=>{
 let s=state(flow.number);s.players[0].oshi=inst('hBP06-002');
 s.players[0].mainDeck=s.players[0].mainDeck.slice(0,deck);
 s.players[0].holoPower=Array.from({length:5},(_,i)=>inst(dummy.number,'hp'+i));
 s.players[1].zones.back1=unit(dummy.number);
 s.players[1].zones[zone]=unit(dummy.number,{damage:9990});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:zone,sourceZone:'center',amount:20}];
 s=applyAction(s,0,attack,custom,()=>0);
 while(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},custom,()=>0);
 assert.equal(s.pendingChoice?.effect==='oshiKnockout',expected);
 if(expected){s=applyAction(s,0,{type:'choose',optionId:'use'},custom,()=>0);assert.equal(s.players[0].spOshiSkillUsed,true);assert.equal(s.players[1].life.length,4);s=applyAction(s,1,{type:'choose',zone:'back1'},custom,()=>0);assert.equal(s.players[1].life.length,3);}
});
