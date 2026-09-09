import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const id=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#ID1期生'));
const custom=[...pool.filter(c=>c.number!==id.number),{...id,arts:[{...dummy.arts[0],damage:0}]}];
for(const empty of [true,false])test('Area15 special-damage knockout cheer deck empty '+empty,()=>{
 let s=state(id.number);s.phase='main';s.players[0].hand=[inst('hBP06-095','event')];
 s.players[0].cheerDeck=empty?[]:[inst('hY01-001','cheer')];
 s=applyAction(s,0,{type:'play',cardId:'event'},custom,()=>0);
 s.phase='performance';s.players[1].zones.center.damage=9990;s.players[1].zones.back1=unit(dummy.number);
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',amount:20}];
 s=applyAction(s,0,attack,custom,()=>0);
 assert.equal(s.players[1].life.length,empty?3:4);
});
