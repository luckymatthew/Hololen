import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,unit,attack} from './fixtures/simulator-audit.mjs';

test('hBP06-051 optional Arts cost archives one source Cheer and draws only with Moona Oshi',()=>{
 const resolve=oshi=>{
  const s=state('hBP06-051');
  s.players[0].oshi=inst(oshi);
  fund(s.players[0].zones.center,['藍','無色','無色']);
  s.players[0].mainDeck=[inst('hBP01-009','drawn')];
  return applyAction(s,0,{...attack,artIndex:1},pool,()=>0);
 };
 const eligible=resolve('hBP06-006');
 assert.equal(eligible.pendingChoice.effect,'genericKeywordCheerCost');
 assert.equal(eligible.pendingChoice.optional,true);
 const paid=applyAction(eligible,0,{type:'choose',cheerId:'cheer2'},pool,()=>0);
 assert.equal(paid.players[0].archive[0].id,'cheer2');
 assert.equal(paid.players[0].hand[0].id,'drawn');
 const ineligible=resolve('hBP02-005');
 assert.equal(ineligible.pendingChoice,null);
 assert.deepEqual(ineligible.players[0].archive,[]);
 assert.deepEqual(ineligible.players[0].mainDeck.map(card=>card.id),['drawn']);
});

test('hBP06-052 Arts gains 60 only with Moona Oshi and four attached Cheer',()=>{
 for(const [oshi,count,expected] of [
  ['hBP06-006',3,20],['hBP06-006',4,80],['hBP02-005',4,20],
 ]){
  const s=state('hBP06-052');
  s.players[0].oshi=inst(oshi);
  fund(s.players[0].zones.center,['藍',...Array(count-1).fill('無色')]);
  const result=applyAction(s,0,attack,pool,()=>0);
  assert.equal(result.players[1].zones.center.damage,expected,`oshi=${oshi}, cheer=${count}`);
 }
});

test('hBP06-054 Arts gains 10 for each attached Snowpeople',()=>{
 const s=state('hBP06-054');
 fund(s.players[0].zones.center,['藍','藍','無色']);
 s.players[0].zones.center.attachments=[inst('hBP04-106','snow-1'),inst('hBP04-106','snow-2')];
 const result=applyAction(s,0,attack,pool,()=>0);
 assert.equal(result.players[1].zones.center.damage,160);
});

test('hBP06-055 Collab moves three opposing archived Cheer to Center, then offers own Shion Cheer',()=>{
 const s=state();
 s.phase='main';
 s.players[0].oshi=inst('hBP02-005');
 s.players[0].zones.back1=unit('hBP06-055');
 s.players[0].zones.center=unit('hBP02-042');
 s.players[0].archive=[inst('hY04-001','own-cheer')];
 s.players[1].archive=['enemy-cheer-1','enemy-cheer-2','enemy-cheer-3'].map(id=>inst('hY01-001',id));
 s.players[1].zones.center=unit('AUDIT-DUMMY');
 let result=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(result.pendingChoice.type,'cardSelection');
 assert.equal(result.pendingChoice.effect,'opponentArchiveCheerToStage');
 result=applyAction(result,0,{type:'choose',cardIds:['enemy-cheer-1','enemy-cheer-2','enemy-cheer-3']},pool,()=>0);
 for(let i=0;i<3;i++){
  assert.equal(result.pendingChoice.type,'stageTarget');
  assert.equal(result.pendingChoice.effect,'attachOpponentArchiveCheer');
  result=applyAction(result,0,{type:'choose',zone:'center'},pool,()=>0);
  assert.equal(result.players[1].zones.center.cheer.length,i+1);
 }
 assert.equal(result.players[1].zones.center.cheer.length,3);
 assert.equal(result.players[0].zones.collab.stack[0].number,'hBP06-055');
 assert.equal(result.pendingChoice.effect,'archiveCheerToStage');
 result=applyAction(result,0,{type:'choose',cardIds:['own-cheer']},pool,()=>0);
 assert.equal(result.pendingChoice.type,'stageTarget');
 result=applyAction(result,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(result.players[0].zones.center.cheer[0].id,'own-cheer');
 assert.equal(result.players[0].archive.length,0);
});

test('hBP06-055 Arts archives the revealed cards, adds damage per Holomen and draws two when an Event appears',()=>{
 const event=cards.find(card=>card.typeCode==='supportEvent');
 assert.ok(event,'test fixture includes a Support Event');
 const s=state('hBP06-055');
 fund(s.players[0].zones.center,['藍','紫']);
 s.players[0].mainDeck=[
  inst('hBP01-009','revealed-1'),
  inst('hBP01-010','revealed-2'),
  inst(event.number,'revealed-event'),
  inst('hBP01-102','revealed-support'),
  inst('hBP01-011','draw-1'),
  inst('hBP01-012','draw-2'),
 ];
 const result=applyAction(s,0,attack,pool,()=>0);
 assert.equal(result.players[1].zones.center.damage,140);
 assert.deepEqual(result.players[0].archive.map(card=>card.id),['revealed-1','revealed-2','revealed-event','revealed-support']);
 assert.deepEqual(result.players[0].hand.map(card=>card.id),['draw-1','draw-2']);
 assert.equal(result.players[0].turnEvents.deckArchived,4);
});

test('hBP06-057 Arts draws first, then requires archiving one hand card',()=>{
 const s=state('hBP06-057');
 fund(s.players[0].zones.center,['無色']);
 s.players[0].hand=[inst('hBP01-009','before')];
 s.players[0].mainDeck=[inst('hBP01-010','drawn')];
 let result=applyAction(s,0,attack,pool,()=>0);
 assert.equal(result.players[0].hand.length,2);
 assert.equal(result.pendingChoice.effect,'handToArchive');
 result=applyAction(result,0,{type:'choose',cardIds:['before']},pool,()=>0);
 assert.deepEqual(result.players[0].archive.map(card=>card.id),['before']);
 assert.deepEqual(result.players[0].hand.map(card=>card.id),['drawn']);
});
