import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
const weapon=cards.find(c=>c.jpName==='古代武器');
function setup(){const s=state();s.phase='main';s.players[0].oshi=inst('hBP04-007');s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','hp'+i));return s;}
test('ancient weapon Oshi deck attachment required',()=>{
 let s=setup();s.players[0].mainDeck=[inst(weapon.number,'weapon')];
 s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
 assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['weapon']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.ok(s.players[0].zones.center.attachments.some(c=>c.id==='weapon'));
});
test('ancient weapon SP cheer mandatory for each holder',()=>{
 let s=setup();s.players[0].zones.center.attachments=[inst(weapon.number,'w1')];
 s.players[0].zones.back1=unit('AUDIT-DUMMY',{attachments:[inst(weapon.number,'w2')]});
 s.players[0].archive=[inst('hY01-001','c1'),inst('hY02-001','c2')];
 s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);
 for(const [id,zone] of [['c1','center'],['c2','back1']]){
  assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);
  assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
  s=applyAction(s,0,{type:'choose',cardIds:[id]},pool,()=>0);

  assert.ok(s.players[0].zones[zone].cheer.some(c=>c.id===id));
 }
});

