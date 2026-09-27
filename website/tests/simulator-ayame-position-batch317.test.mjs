import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [zone,life,allowed] of [['center',5,true],['collab',5,false],['collab',2,true]])test(`Ayame Arts position ${zone} life ${life}`,()=>{
 const s=state();s.players[0].zones[zone]=unit('hBP06-039');s.players[0].life=s.players[0].life.slice(0,life);
 fund(s.players[0].zones[zone],['紅','紅']);
 if(!allowed){assert.throws(()=>applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0));return;}
 const end=applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0);
 assert.equal(end.players[1].zones.center.damage,80);
});

const ayameOshi=cards.find(c=>c.group==='oshi'&&c.jpName==='百鬼あやめ');
for(const count of [1,2,3])test(`Ayame Arts archives ${count} top Cheer and gains 40 per card`,()=>{
 const s=state('hBP06-039');s.players[0].oshi=inst(ayameOshi.number);
 fund(s.players[0].zones.center,['紅','紅']);
 s.players[0].cheerDeck=Array.from({length:count},(_,i)=>inst('hY01-001',`top${i}`));
 let end=applyAction(s,0,attack,pool,()=>0);
 assert.equal(end.pendingChoice?.effect,'genericKeywordCheerDeckCost');
 end=applyAction(end,0,{type:'choose',optionId:String(count)},pool,()=>0);
 assert.equal(end.players[1].zones.center.damage,80+count*40);
 assert.deepEqual(end.players[0].archive.map(c=>c.id),Array.from({length:count},(_,i)=>`top${i}`));
 assert.equal(end.players[0].cheerDeck.length,0);
});

test('Ayame Arts may skip its top-Cheer cost without bonus',()=>{
 const s=state('hBP06-039');s.players[0].oshi=inst(ayameOshi.number);
 fund(s.players[0].zones.center,['紅','紅']);s.players[0].cheerDeck=[inst('hY01-001','top')];
 let end=applyAction(s,0,attack,pool,()=>0);
 end=applyAction(end,0,{type:'choose',skip:true},pool,()=>0);
 assert.equal(end.players[1].zones.center.damage,80);
 assert.equal(end.players[0].archive.length,0);
 assert.equal(end.players[0].cheerDeck.length,1);
});
