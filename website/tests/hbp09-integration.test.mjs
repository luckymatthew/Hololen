import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,cards,N,instance,unit,act,answer,conserve} from './hbp09-fixtures.mjs';
import {publicRoomState} from '../lib/simulator/engine.mjs';
import {runAiStep} from '../lib/simulator/ai.mjs';
import {oshiSkillMinimumPower} from '../lib/simulator/oshi-skill-catalog.mjs';
const reload=x=>JSON.parse(JSON.stringify(x));

test('Hajime permits zero power from UI minimum through reducer and rejects reuse',()=>{
 const s=fixture(2,21);s.players[0].holoPower=[];
 assert.equal(oshiSkillMinimumPower(N(2)),0);
 let out=act(s,{type:'oshiSkill'});assert.deepEqual(out.pendingChoice.modeOptions.map(x=>x.id),['0']);
 out=answer(reload(out),{optionId:'0'});assert.equal(out.players[0].oshiSkillTurn,s.turn);
 assert.throws(()=>act(out,{type:'oshiSkill'}));conserve(s,out);
});

test('Subaru deployment exposes real stage targets and resumes after PvP serialization',()=>{
 const s=fixture(1,8);s.players[0].mainDeck.unshift(instance(N(10)));
 s.players[1].zones.back1=unit(N(17));
 let out=answer(act(s,{type:'oshiSkill'}),{zone:'back1'});
 const picked=out.pendingChoice.cards[0];out=answer(out,{cardIds:[picked.id]});
 assert.equal(out.pendingChoice.type,'stageTarget');assert.equal(out.pendingChoice.cardNumber,N(10));
 assert.deepEqual(publicRoomState(out,1).pendingChoice,{type:'opponent',playerIndex:0});
 assert.equal(publicRoomState(out,0).pendingChoice.cardId,picked.id);
 const saved=reload(out);assert.throws(()=>answer(saved,{zone:'center'}));assert.deepEqual(saved,reload(out));
 out=answer(saved,{zone:'back4'});assert.equal(out.players[0].zones.back4.stack[0].id,picked.id);conserve(s,out);
});

test('AI resolves hBP09 searches, X payments and stage choices after reload',()=>{
 for(const [oshi,center] of [[1,8],[2,21],[3,25],[7,77]]){
  const s=fixture(oshi,center);s.players[0].mainDeck.unshift(instance(N(14)),instance(N(95)));
  s.players[0].archive.push(instance('hY01-015'));let out=act(s,{type:'oshiSkill'});
  for(let steps=0;out.pendingChoice&&steps<10;steps++){
   const prior=out;out=runAiStep(reload(out),cards,0,()=>0.4);
   assert.notDeepEqual(out,prior,`AI stuck on ${oshi} ${prior.pendingChoice.type}`);
  }
  assert.equal(out.pendingChoice,null,`AI continuation ${oshi}`);
 }
});

test('simultaneous hBP09 end triggers are ordered by player before turn reset',()=>{
 const s=fixture(5,53);s.phase='performance';
 s.players[0].zones.back1=unit(N(77));s.players[0].zones.back1.lastArtsTurn=3;
 const snow=instance(N(110));s.players[0].zones.back1.attachments=[snow];
 s.players[0].turnEvents.arts=[N(53),N(53)];
 let out=act(s,{type:'advance'});
 assert.equal(out.pendingChoice.type,'optionChoice');assert.equal(out.turn,3);
 const choice=out.pendingChoice.modeOptions.find(x=>x.label.startsWith(N(110)));
 assert.ok(choice);assert.throws(()=>answer(out,{optionId:'999'}));
 out=answer(reload(out),{optionId:choice.id});
 assert.equal(out.pendingChoice.type,'cardSelection');assert.equal(out.turn,3);
 out=answer(out,{cardIds:[snow.id]});
 assert.equal(out.players[0].hand.length,1);assert.equal(out.pendingChoice.type,'optionChoice');assert.equal(out.turn,3);
 out=answer(reload(out),{optionId:'yes'});
 assert.equal(out.players[0].hand.length,3);assert.equal(out.players[0].holoPower.length,8);
 assert.equal(out.turn,4);conserve(s,out);
});

test('multiple snow triggers preserve card identities and each resolve once',()=>{
 const s=fixture(6,77);s.phase='performance';s.players[0].zones.back1=unit(N(77));
 for(const u of [s.players[0].zones.center,s.players[0].zones.back1]){u.lastArtsTurn=3;u.attachments=[instance(N(110))];}
 let out=act(s,{type:'advance'});out=answer(out,{optionId:'1'});
 const id=out.pendingChoice.selectableIds[0];out=answer(out,{cardIds:[id]});
 assert.equal(out.pendingChoice.type,'cardSelection');assert.notEqual(out.pendingChoice.selectableIds[0],id);
 out=answer(out,{cardIds:[out.pendingChoice.selectableIds[0]]});
 assert.equal(out.players[0].hand.length,2);assert.equal(out.turn,4);conserve(s,out);
});
