import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
function setup(number='AUDIT-DUMMY'){let s=state(number);s.phase='main';s.players[0].oshi=inst('hBP06-008');s.players[0].holoPower=Array.from({length:3},(_,i)=>inst('AUDIT-DUMMY','hp'+i));return s;}
test('Matsuri winning die search mandatory',()=>{let s=applyAction(setup(),0,{type:'oshiSkill'},pool,()=>0.99);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);});
for(const valid of [true,false])test('Matsuri SP named center '+valid,()=>{const matsuri=cards.find(c=>c.jpName==='夏色まつり'&&c.group==='holomem');let s=setup(valid?matsuri.number:'AUDIT-DUMMY');if(!valid){assert.throws(()=>applyAction(s,0,{type:'spOshiSkill'},pool,()=>0));return;}s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);assert.equal(s.players[0].limitedAllowance,2);});
