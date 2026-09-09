import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
test('Botan Oshi SP triggers center Botan Gift',()=>{
 const target={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'FIRST-TARGET',stage:'1st'};let s=state('hBP05-028','FIRST-TARGET');s.phase='main';s.players[0].oshi=inst('hBP03-002');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','p'+i));s=applyAction(s,0,{type:'spOshiSkill'},[...pool,target],()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},[...pool,target],()=>0);assert.equal(s.players[1].zones.center.damage,100);assert.equal(s.players[0].hand.length,1);
});
test('Botan Buzz loses two life',()=>{let s=state('AUDIT-DUMMY','hBP05-028');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP05-028').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);});
