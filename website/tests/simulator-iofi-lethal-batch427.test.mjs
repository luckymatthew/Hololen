import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
const card={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'IOFI-LETHAL',tags:['#ID1期生']};const cards=[...pool,card];
for(const kind of ['arts','special'])for(const use of [true,false])test('Iofi lethal '+kind+' use '+use,()=>{
 let s=state('AUDIT-DUMMY',card.number);const p=s.players[1];p.oshi=inst('hBP05-002');p.holoPower=[inst('AUDIT-DUMMY','power')];p.zones.center.damage=9990;p.zones.center.cheer=[inst('hY01-001','move')];p.zones.back1=unit(card.number,{stack:[inst(card.number,'recipient')]});
 if(kind==='special')s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',amount:20,sourceName:'test'}];
 s=applyAction(s,0,attack,cards,()=>0);assert.equal(s.pendingChoice.effect,'iofiDamagedUse');assert.equal(s.players[1].life.length,5);
 s=applyAction(s,1,{type:'choose',...(use?{optionId:'use'}:{skip:true})},cards,()=>0);
 if(use){s=applyAction(s,1,{type:'choose',cheerId:'move'},cards,()=>0);s=applyAction(s,1,{type:'choose',zone:'back1'},cards,()=>0);assert.ok(s.players[1].zones.back1.cheer.some(c=>c.id==='move'));}
 assert.equal(s.players[1].zones.center,null);assert.equal(s.players[1].life.length,4);assert.equal(s.players[1].archive.some(c=>c.id==='move'),!use);
});
