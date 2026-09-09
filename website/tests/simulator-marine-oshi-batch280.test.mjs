import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const marine=stage=>cards.find(c=>c.jpName==='宝鐘マリン'&&c.stage===stage);
function setup(number){let s=state(number);s.phase='main';s.players[0].oshi=inst('hBP02-003');s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','hp'+i));return s;}
for(const valid of [true,false])test('Marine extra Bloom legal stage '+valid,()=>{let s=setup(marine(valid?'1st':'2nd').number);s.players[0].zones.center.bloomedTurn=s.turn;s.players[0].hand=[inst(marine('1st').number,'bloom')];if(!valid){assert.throws(()=>applyAction(s,0,{type:'oshiSkill'},pool,()=>0));return;}s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['bloom']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.stack.length,2);});
for(const count of [0,2])test('Marine SP counts underlying Holomen '+count,()=>{let s=setup(marine('2nd').number);s.players[0].zones.center.stack=[...Array.from({length:count},(_,i)=>inst(marine('1st').number,'under'+i)),inst(marine('2nd').number,'top')];s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,count*50);});
test('Marine SP rejects other center',()=>{assert.throws(()=>applyAction(setup('AUDIT-DUMMY'),0,{type:'spOshiSkill'},pool,()=>0));});
