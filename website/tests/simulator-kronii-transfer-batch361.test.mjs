import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [oshi,skip] of [[true,false],[false,false],[true,true]])test('Kronii transfer bonus '+oshi+' '+skip,()=>{
 let s=state('hBP07-056');fund(s.players[0].zones.center,['藍','藍','無色','無色']);const target=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#Promise')&&c.stage==='Debut');s.players[0].zones.back1=unit(target.number);if(oshi)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='オーロ・クロニー').number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'genericMoveCheer');s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',zone:'center',cheerId:'cheer0'},pool,()=>0);if(!skip)s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,oshi&&!skip?180:80);assert.equal(s.players[0].zones.back1.cheer.length,skip?0:1);
});
