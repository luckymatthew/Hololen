import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const valid of [false,true])test('043 FUWAMOCO Oshi gate '+valid,()=>{
 let s=state('hBP03-043');fund(s.players[0].zones.center,['藍','紅','無色']);s.players[0].zones.back1=unit('hBP03-037');
 if(valid)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='FUWAMOCO').number);
 s=act(s,{...attack,artIndex:1});
 if(!valid){assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,100);return;}
 assert.equal(s.pendingChoice.effect,'genericMoveCheer');s=act(s,{type:'choose',cheerId:'cheer0'});s=act(s,{type:'choose',zone:'back1'});
 assert.equal(s.players[0].zones.back1.cheer[0].id,'cheer0');assert.equal(s.players[1].zones.center.damage,150);
});
