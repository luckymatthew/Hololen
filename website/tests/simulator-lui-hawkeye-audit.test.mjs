import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, dummy, state, fund } from './fixtures/simulator-audit.mjs';
const act=(s,p,a)=>applyAction(JSON.parse(JSON.stringify(s)),p,a,pool,()=>.5);
const id=u=>u?.stack.at(-1).id;
function cast({collab=true,extra=false,power=2}={}) {
  const s=state();s.phase='main';
  s.players[0].oshi=inst('hBP01-005');
  s.players[0].holoPower=Array.from({length:power},(_,i)=>inst(dummy.number,'power'+i));
  s.players[0].extraTurnPending=extra?1:0;
  s.players[1].zones.center=unit(dummy.number,{stack:[inst(dummy.number,'center')]});
  s.players[1].zones.back1=unit(dummy.number,{stack:[inst(dummy.number,'back')]});
  if(collab)s.players[1].zones.collab=unit(dummy.number,{stack:[inst(dummy.number,'collab')],rested:true,returnSlot:'back2'});
  return act(s,0,{type:'spOshiSkill'});
}
function endTurn(s){s=JSON.parse(JSON.stringify(s));s.phase='performance';return act(s,s.activePlayer,{type:'advance'});}
function queueSwap(s,zone='center') {
  s=JSON.parse(JSON.stringify(s));
  s.phase='main';
  s.effectQueue=[{type:'stageTarget',playerIndex:s.activePlayer,targetPlayerIndex:1,options:['back1'],rule:{zones:['back1']},effect:zone==='center'?'swapCenter':'swapCollab',prompt:'audit',optional:false,meta:{}}];
  return act(s,s.activePlayer,{type:'advance'});
}
test('Hawkeye pays exactly two topmost Holo Power and is once per game',()=>{
  const s=cast({power:3});
  assert.deepEqual(s.players[0].holoPower.map(c=>c.id),['power0']);
  assert.deepEqual(s.players[0].archive.map(c=>c.id),['power2','power1']);
  assert.equal(s.players[0].spOshiSkillUsed,true);
  assert.throws(()=>act(s,0,{type:'spOshiSkill'}));
  assert.throws(()=>cast({power:1}));
});
test('Q37: opponent center can still be swapped during the casting turn',()=>{
  const pending=queueSwap(cast());
  const end=act(pending,0,{type:'choose',zone:'back1'});
  assert.equal(id(end.players[1].zones.center),'back');
});
test('Q36: reset keeps locked collab in place and does not rest it',()=>{
  const s=endTurn(cast());
  assert.equal(s.activePlayer,1);
  assert.equal(id(s.players[1].zones.collab),'collab');
  assert.equal(s.players[1].zones.collab.rested,false);
  assert.equal(s.players[1].zones.back2,null);
});
test('Q220: only collab remains, center is not filled from the locked collab',()=>{
  const s=cast();s.players[1].zones.center=null;s.players[1].zones.back1=null;
  const end=endTurn(s);
  assert.equal(end.players[1].zones.center,null);
  assert.equal(id(end.players[1].zones.collab),'collab');
  assert.equal(end.pendingChoice,null);
});
test('Q289: back Holomem may collab when collab position is empty',()=>{
  const s=endTurn(cast({collab:false}));
  const end=act(s,1,{type:'collab',zone:'back1'});
  assert.equal(id(end.players[1].zones.collab),'back');
  assert.equal(id(end.players[1].zones.center),'center');
});
test('baton is prohibited during the affected turn',()=>{
  const s=endTurn(cast());
  assert.throws(()=>act(s,1,{type:'baton',zone:'back1'}),/不能/);
});
for(const zone of ['center','collab']) test(`locked ${zone} swap resolves without moving or trapping a mandatory choice`,()=>{
  const s=queueSwap(endTurn(cast()),zone);
  assert.equal(s.pendingChoice,null);
  assert.equal(id(s.players[1].zones[zone]),zone);
  assert.equal(id(s.players[1].zones.back1),'back');
});
test('Switch support cannot bypass the center lock or leave an impossible prompt',()=>{
  const s=endTurn(cast());s.players[1].hand.push(inst('hBP01-106','switch'));
  const end=act(s,1,{type:'play',cardId:'switch'});
  assert.equal(end.pendingChoice,null);
  assert.equal(id(end.players[1].zones.center),'center');
  assert.ok(end.players[1].archive.some(c=>c.id==='switch'));
});
test('casting-side extra turn does not consume the next-opponent-turn duration',()=>{
  const extra=endTurn(cast({extra:true}));
  assert.equal(extra.activePlayer,0);
  assert.equal(extra.turn,4);
  const targetTurn=endTurn(extra);
  assert.equal(targetTurn.activePlayer,1);
  assert.equal(targetTurn.turn,5);
  assert.equal(id(targetTurn.players[1].zones.collab),'collab');
  assert.throws(()=>act(targetTurn,1,{type:'baton',zone:'back1'}),/不能/);
});
test('lock ends after the affected turn, including before another opponent turn',()=>{
  const targetTurn=endTurn(cast());
  targetTurn.players[1].extraTurnPending=1;
  const extra=endTurn(targetTurn);
  assert.equal(extra.activePlayer,1);
  assert.equal(extra.players[1].zones.collab,null);
  assert.equal(id(extra.players[1].zones.back2),'collab');
  const pending=queueSwap(extra);
  const end=act(pending,1,{type:'choose',zone:'back1'});
  assert.equal(id(end.players[1].zones.center),'back');
});
test('Q33: knockout still archives a locked center',()=>{
  const s=endTurn(cast());
  s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',amount:20000,loseLife:true,sourceName:'audit'}];
  const end=act(s,1,{type:'advance'});
  assert.equal(end.players[1].zones.center,null);
  assert.ok(end.players[1].archive.some(c=>c.id==='center'));
  assert.equal(end.players[1].life.length,4);
});
test('Q38: Kiara may archive an underneath Holomem while center movement is locked',()=>{
  const s=endTurn(cast());s.phase='performance';
  const card=cards.find(c=>c.number==='hBP01-066');
  s.players[1].zones.center=unit(card.number,{stack:[inst('hBP01-062','under'),inst(card.number,'kiara')]});
  fund(s.players[1].zones.center,card.arts[1].cost);
  s.players[0].zones.collab=unit(dummy.number);
  const pending=act(s,1,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:1});
  const end=act(pending,1,{type:'choose',cardIds:['under']});
  assert.equal(id(end.players[1].zones.center),'kiara');
  assert.equal(end.players[1].zones.center.stack.length,1);
  assert.ok(end.players[1].archive.some(c=>c.id==='under'));
  assert.equal(end.players[0].zones.collab.damage,40);
});
test('Flare SP cannot swap a locked center, and does not heal a card that never moved',()=>{
  const s=endTurn(cast());
  s.players[1].oshi=inst('hSD07-001');
  s.players[1].holoPower=[inst(dummy.number,'sp0'),inst(dummy.number,'sp1')];
  s.players[1].zones.center.damage=40;
  const end=act(s,1,{type:'spOshiSkill'});
  assert.equal(end.pendingChoice,null);
  assert.equal(id(end.players[1].zones.center),'center');
  assert.equal(end.players[1].zones.center.damage,40);
});
