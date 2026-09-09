import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const recipient of ['center','back1','none'])test('Korone bonus only named skill recipient '+recipient,()=>{
 let s=state('hBP06-069');s.phase='main';s.players[0].oshi=inst('hBP03-006');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].zones.back1=unit('hBP06-069',{rested:true});fund(s.players[0].zones.center,['無色']);
 if(recipient!=='none'){
  s.players[0].zones[recipient].rested=true;
  s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:recipient},pool,()=>0);
 }
 s.phase='performance';s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,recipient==='center'?80:30);
});
