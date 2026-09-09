import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [3,5,6,8,9]) for(const matching of [true,false]) test('Iofi stage cheer '+count+' matching Oshi '+matching,()=>{
 const s=state('hBP05-023');
 fund(s.players[0].zones.center,['綠','無色','無色']);
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:Array.from({length:count-3},(_,i)=>inst('hY01-001','back'+i))});
 if(matching)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='アイラニ・イオフィフティーン').number);
 const r=applyAction(s,0,attack,pool,()=>0);
 assert.equal(r.players[1].zones.center.damage,130+(matching?Math.floor(count/3)*20:0));
});
test('Iofi bonus requires center',()=>{
 const s=state();s.players[0].zones.collab=unit('hBP05-023');fund(s.players[0].zones.collab,['綠','無色','無色']);
 s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='アイラニ・イオフィフティーン').number);
 const r=applyAction(s,0,{...attack,sourceZone:'collab'},pool,()=>0);assert.equal(r.players[1].zones.center.damage,130);
});
