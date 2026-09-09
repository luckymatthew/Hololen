import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';

const withDie=(s,a,die)=>applyAction(structuredClone(s),0,a,pool,()=> (die-.5)/6);
const choose=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);

function koboBloom({oshi='hBP01-008',power=true,used=false}={}) {
  const s=state('hBP01-082');
  s.phase='main';
  s.players[0].oshi=inst(oshi);
  s.players[0].holoPower=power?[inst('AUDIT-DUMMY','power')]:[];
  s.players[0].oshiSkillTurn=used?s.turn:0;
  s.players[0].zones.center.cheer=[inst('hY04-001','cost')];
  s.players[0].hand=[inst('hBP03-045','bloom')];
  s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back1')]});
  s.players[1].zones.back2=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back2')]});
  return choose(choose(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}

test('Kobo rain Bloom opens its Oshi reaction before the three split hits',()=>{
  let s=koboBloom();
  assert.equal(s.pendingChoice?.effect,'idCheerCostSplitDamage');
  s=choose(s,{type:'choose',cheerId:'cost'});
  assert.equal(s.pendingChoice?.effect,'hBP01-008CheerArchive');
  s=choose(s,{type:'choose',optionId:'use'});
  assert.equal(s.pendingChoice?.type,'stageTarget');
  assert.match(s.pendingChoice.prompt,/雨之薩滿術/u);
  s=choose(s,{type:'choose',zone:'center'});
  assert.equal(s.players[0].holoPower.length,0);
  assert.equal(s.players[0].oshiSkillTurn,s.turn);
  assert.equal(s.players[1].zones.center.damage,20);
  assert.match(s.pendingChoice.prompt,/分配特殊傷害（1\/3）/u);
});

test('Kobo rain Oshi reaction may be declined without spending Holo Power',()=>{
  let s=choose(koboBloom(),{type:'choose',cheerId:'cost'});
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.players[0].holoPower.length,1);
  assert.equal(s.players[0].oshiSkillTurn,0);
  assert.match(s.pendingChoice.prompt,/分配特殊傷害（1\/3）/u);
});

for(const options of [{power:false},{used:true},{oshi:'AUDIT-OSHI'}]) test('Kobo rain does not offer an illegal Oshi reaction '+JSON.stringify(options),()=>{
  const s=choose(koboBloom(options),{type:'choose',cheerId:'cost'});
  assert.equal(s.pendingChoice?.effect,'specialDamage');
  assert.match(s.pendingChoice.prompt,/分配特殊傷害（1\/3）/u);
});

function kanataBloom({mascot=true}={}) {
  const s=state('hBP01-009');
  s.phase='main';
  s.players[0].hand=[inst('hBP01-012','bloom')];
  s.players[0].mainDeck=[inst(mascot?'hBP01-116':'AUDIT-DUMMY','candidate'),inst('AUDIT-DUMMY','tail')];
  return choose(choose(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}

test('Kanata Bloom die is optional and decline does not invoke randomness',()=>{
  const s=kanataBloom();
  assert.equal(s.pendingChoice?.effect,'kanataBloomRoll');
  let calls=0;
  const end=applyAction(s,0,{type:'choose',skip:true},pool,()=>{calls++;return .5;});
  assert.equal(calls,0);
  assert.equal(end.pendingChoice,null);
});

for(const die of [1,2,3]) test('Kanata Bloom result '+die+' finds a mascot',()=>{
  let s=withDie(kanataBloom(),{type:'choose',optionId:'roll'},die);
  assert.equal(s.pendingChoice?.effect,'deckSupportToAttach');
  assert.equal(s.pendingChoice.optional,true);
  assert.equal(s.pendingChoice.min,0);
  assert.deepEqual(s.pendingChoice.selectableIds,['candidate']);
  s=choose(s,{type:'choose',cardIds:['candidate']});
  assert.equal(s.pendingChoice?.type,'attachArchivedSupport');
  s=choose(s,{type:'choose',zone:'center'});
  assert.equal(s.players[0].zones.center.attachments[0].id,'candidate');
});

for(const die of [4,5,6]) test('Kanata Bloom result '+die+' does not search',()=>{
  const end=withDie(kanataBloom(),{type:'choose',optionId:'roll'},die);
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].zones.center.attachments.length,0);
});

test('Kanata successful hidden-deck search may reveal no mascot',()=>{
  let s=withDie(kanataBloom(),{type:'choose',optionId:'roll'},1);
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.pendingChoice,null);
  assert.equal(s.players[0].zones.center.attachments.length,0);
});

test('Kanata successful die with no mascot finishes after shuffling',()=>{
  const end=withDie(kanataBloom({mascot:false}),{type:'choose',optionId:'roll'},1);
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].zones.center.attachments.length,0);
});

function mumei(top='hBP01-017') {
  const s=state('hBP01-018');
  s.players[0].mainDeck=top?[inst(top,'top')]:[];
  fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-018').arts[0].cost);
  return choose(s,attack);
}

test('Mumei may decline Memory Fragment without moving or revealing the top card',()=>{
  let s=mumei();
  assert.equal(s.pendingChoice?.effect,'mumeiMemoryFragment');
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.players[0].mainDeck[0].id,'top');
  assert.equal(s.players[0].hand.length,0);
  assert.equal(s.players[1].zones.center.damage,20);
});

test('Mumei revealing a Promise top card adds it to hand and this Arts gains 20',()=>{
  let s=mumei('hBP01-017');
  s=choose(s,{type:'choose',optionId:'reveal'});
  assert.equal(s.players[0].hand[0].id,'top');
  assert.equal(s.players[1].zones.center.damage,40);
  assert.ok(s.log.some(entry=>String(entry.message||'').includes('公開')));
});

test('Mumei revealing a non-Promise top card adds it to hand without an Arts bonus',()=>{
  let s=mumei('AUDIT-DUMMY');
  s=choose(s,{type:'choose',optionId:'reveal'});
  assert.equal(s.players[0].hand[0].id,'top');
  assert.equal(s.players[1].zones.center.damage,20);
});

test('Mumei with an empty deck has no reveal choice and deals base damage',()=>{
  const end=mumei('');
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[1].zones.center.damage,20);
});
