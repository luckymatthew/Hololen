import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const enabled of [true,false])test('Flare Parfait recipient bonus '+enabled,()=>{
 let s=state('hBP07-085');fund(s.players[0].zones.center,['黃']);s.players[0].zones.back1=unit('hBP07-085');fund(s.players[0].zones.back1,['黃','黃','黃']);if(enabled)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='不知火フレア').number);
 s=applyAction(s,0,attack,pool,()=>0);if(enabled){assert.equal(s.pendingChoice.effect,'flareParfaitBuff');s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.ok(s.players[0].zones.back1.modifiers.some(m=>m.kind==='arts'&&m.amount===60));}else assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,20);
});

test('Flare choosing self buffs current Arts',()=>{
 let s=state('hBP07-085');fund(s.players[0].zones.center,['黃','黃']);s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='不知火フレア').number);s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,60);
});
