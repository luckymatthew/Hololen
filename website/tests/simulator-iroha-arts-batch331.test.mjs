import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [collab,buzz] of [[true,true],[true,false],[false,false]])test(`Iroha Arts collab ${collab} buzz ${buzz}`,()=>{
 let s=state('hBP06-027');s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='風真いろは').number);if(collab)s.players[0].zones.collab=unit('AUDIT-DUMMY');
 if(buzz)s.players[0].zones.center.stack.unshift(inst(cards.find(c=>c.jpName==='風真いろは'&&c.type.includes('Buzz')).number,'previous'));
 fund(s.players[0].zones.center,['綠','無色','無色']);s.players[1].zones.center.modifiers=[{kind:'artsDamageReduction',amount:30,expiresTurn:3}];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,160+(collab?40:0)-(buzz?0:30));
});
