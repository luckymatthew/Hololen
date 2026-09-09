import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const robo=cards.find(c=>c.number==='hBP06-065');
const custom=[...pool.filter(c=>c.number!==robo.number),{...robo,arts:dummy.arts}];
for(const stage of ['1st','Debut'])test('Roboco Gift requires prior '+stage,()=>{
 const previous=cards.find(c=>c.jpName===robo.jpName&&c.stage===stage);let s=state(robo.number);s.players[0].zones.center.stack.unshift(inst(previous.number,'previous'));
 s=applyAction(s,0,attack,custom,()=>0);
 if(stage==='1st'){assert.equal(s.pendingChoice.effect,'specialDamage');s=applyAction(s,0,{type:'choose',zone:'center'},custom,()=>0);}
 assert.equal(s.players[1].zones.center.damage,stage==='1st'?150:100);
});
test('Roboco Gift does not trigger on source special damage',()=>{
 const previous=cards.find(c=>c.jpName===robo.jpName&&c.stage==='1st');let s=state(robo.number);s.players[0].zones.center.stack.unshift(inst(previous.number,'previous'));s.players[0].zones.collab=unit(dummy.number);
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',amount:10}];
 s=applyAction(s,0,{...attack,sourceZone:'collab'},custom,()=>0);assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,110);
});
test('Roboco Buzz knockout loses two life',()=>{
 let s=state(dummy.number,robo.number);s.players[1].zones.center.damage=robo.hp-10;s.players[1].zones.back1=unit(dummy.number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
