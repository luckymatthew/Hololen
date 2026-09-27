import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';

test('hBP06-063 Bloom special damage requires a Robosa attached somewhere on the own stage',()=>{
 const resolve=withRobosa=>{
  const bloom=cards.find(card=>card.number==='hBP06-063');
  const debut=cards.find(card=>card.jpName===bloom.jpName&&card.stage==='Debut');
  const fan=cards.find(card=>card.jpName==='ろぼさー');
  const s=state();
  s.phase='main';
  s.players[0].zones.center=unit(debut.number);
  if(withRobosa)s.players[0].zones.back1=unit('hBP06-061',{attachments:[inst(fan.number,'fan')]});
  s.players[0].hand=[inst(bloom.number,'bloom')];
  return applyAction(applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0),0,{type:'choose',zone:'center'},pool,()=>0);
 };
 assert.equal(resolve(false).players[1].zones.center.damage,0);
 assert.equal(resolve(true).players[1].zones.center.damage,20);
});

test('hBP06-063 Arts draws only when the Oshi is Roboco',()=>{
 for(const [oshi,expected] of [['hBP06-007',1],['hBP02-005',0]]){
  const s=state('hBP06-063');
  s.players[0].oshi=inst(oshi);
  fund(s.players[0].zones.center,['無色']);
  s.players[0].mainDeck=[inst('hBP01-009','drawn')];
  const result=applyAction(s,0,attack,pool,()=>0);
  assert.equal(result.players[0].hand.length,expected,`oshi=${oshi}`);
  assert.equal(result.players[0].mainDeck.length,1-expected,`oshi=${oshi}`);
 }
});

test('hBP06-065 Arts loses one colorless requirement only after an opposing-turn knockout',()=>{
 const s=state('hBP06-065');
 fund(s.players[0].zones.center,['紫','無色']);
 s.knockouts=[{turn:s.turn-1,ownerIndex:0,sourcePlayerIndex:1,card:{number:'AUDIT-DUMMY'}}];
 assert.equal(applyAction(s,0,attack,pool,()=>0).players[1].zones.center.damage,90);
 const noKnockout=state('hBP06-065');
 fund(noKnockout.players[0].zones.center,['紫','無色']);
 assert.throws(()=>applyAction(noKnockout,0,attack,pool,()=>0));
});

test('hBP06-067 Collab can archive one tagged Gamers Holomen then draws one',()=>{
 const gamers=cards.find(card=>card.group==='holomem'&&card.tags?.includes('#ゲーマーズ'));
 const s=state();
 s.phase='main';
 s.players[0].zones.back1=unit('hBP06-067');
 s.players[0].hand=[inst(gamers.number,'gamers')];
 s.players[0].mainDeck=[inst('hBP01-010','collab-power'),inst('hBP01-009','drawn')];
 let result=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(result.pendingChoice.effect,'genericKeywordHandArchiveCost');
 assert.deepEqual(result.pendingChoice.selectableIds,['gamers']);
 result=applyAction(result,0,{type:'choose',cardIds:['gamers']},pool,()=>0);
 assert.deepEqual(result.players[0].archive.map(card=>card.id),['gamers']);
 assert.deepEqual(result.players[0].hand.map(card=>card.id),['drawn']);
});

test('hBP06-066 center Gift archives the top card only when a #0 collab uses Arts',()=>{
 const resolve=sourceZone=>{
  const s=state();
  if(sourceZone==='collab')s.players[0].zones.center=unit('hBP06-066');
  else s.players[0].zones.back1=unit('hBP06-066');
  s.players[0].zones[sourceZone]=unit('hBP01-044');
  fund(s.players[0].zones[sourceZone],['無色']);
  s.players[0].mainDeck=[inst('hBP01-009','top'),inst('hBP01-010','next')];
  return applyAction(s,0,{type:'attack',sourceZone,targetZone:'center',artIndex:0},pool,()=>0);
 };
 const triggered=resolve('collab');
 assert.equal(triggered.pendingChoice,null);
 assert.deepEqual(triggered.players[0].archive.map(card=>card.id),['top']);
 assert.deepEqual(triggered.players[0].mainDeck.map(card=>card.id),['next']);
 assert.equal(triggered.players[0].turnEvents.deckArchived,1);
 const wrongSource=resolve('center');
 assert.equal(wrongSource.pendingChoice,null);
 assert.deepEqual(wrongSource.players[0].archive,[]);
});

test('hBP06-068 Arts draws and archives only when a Support is attached somewhere on the stage',()=>{
 const resolve=withSupport=>{
  const s=state('hBP06-068');
  fund(s.players[0].zones.center,['無色','無色']);
  s.players[0].hand=[inst('hBP01-009','before')];
  s.players[0].mainDeck=[inst('hBP01-010','drawn')];
  if(withSupport)s.players[0].zones.back1=unit('hBP06-067',{attachments:[inst('hBP01-103','support')]});
  return applyAction(s,0,attack,pool,()=>0);
 };
 const disabled=resolve(false);
 assert.equal(disabled.pendingChoice,null);
 assert.deepEqual(disabled.players[0].hand.map(card=>card.id),['before']);
 const enabled=resolve(true);
 assert.equal(enabled.pendingChoice.effect,'handToArchive');
 assert.deepEqual(enabled.players[0].hand.map(card=>card.id),['before','drawn']);
 const resolved=applyAction(enabled,0,{type:'choose',cardIds:['before']},pool,()=>0);
 assert.deepEqual(resolved.players[0].archive.map(card=>card.id),['before']);
 assert.deepEqual(resolved.players[0].hand.map(card=>card.id),['drawn']);
});
