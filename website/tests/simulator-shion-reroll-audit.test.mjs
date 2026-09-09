import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';

const withDie=(s,a,die)=>applyAction(structuredClone(s),0,a,pool,()=> (die-.5)/6);
const choose=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);

function collabSetup({oshi=false,wand=false,central='hBP02-046'}={}) {
  const s=state(central);
  s.phase='main';
  s.players[0].zones.center.attachments=wand?[inst('hBP02-087','wand')]:[];
  s.players[0].zones.back1=unit('hBP02-043');
  s.players[0].oshi=inst(oshi?'hBP02-005':'AUDIT-OSHI');
  s.players[0].holoPower=oshi?[inst('AUDIT-DUMMY','starting-power')]:[];
  s.players[0].mainDeck=[inst('AUDIT-DUMMY','collab-power'),inst('hBP02-087','magic'),inst('AUDIT-DUMMY','wrong'),inst('AUDIT-DUMMY','tail')];
  return choose(s,{type:'collab',zone:'back1'});
}

test('hBP02-043 Collab roll is optional and decline never invokes randomness',()=>{
  const s=collabSetup();
  assert.equal(s.pendingChoice?.effect,'shionCollabRoll');
  let calls=0;
  const end=applyAction(s,0,{type:'choose',skip:true},pool,()=>{calls++;return .5;});
  assert.equal(calls,0);
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].hand.length,0);
});

for(const die of [1,2,3]) test('hBP02-043 misses cleanly on '+die,()=>{
  const end=withDie(collabSetup(),{type:'choose',optionId:'roll'},die);
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].hand.length,0);
});

for(const die of [4,5,6]) test('hBP02-043 hit '+die+' offers one #Magic search result',()=>{
  let s=withDie(collabSetup(),{type:'choose',optionId:'roll'},die);
  assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');
  assert.equal(s.pendingChoice.optional,true);
  assert.equal(s.pendingChoice.min,0);
  assert.deepEqual(s.pendingChoice.selectableIds,['magic']);
  assert.throws(()=>choose(s,{type:'choose',cardIds:['wrong']}));
  s=choose(s,{type:'choose',cardIds:['magic']});
  assert.equal(s.players[0].hand[0].id,'magic');
  assert.equal(s.pendingChoice,null);
});

test('hBP02-043 successful hidden-deck search may reveal no #Magic card',()=>{
  let s=withDie(collabSetup(),{type:'choose',optionId:'roll'},4);
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.pendingChoice,null);
  assert.equal(s.players[0].hand.length,0);
});

test('hBP02-005 may keep the original Shion die without paying',()=>{
  let s=withDie(collabSetup({oshi:true}),{type:'choose',optionId:'roll'},5);
  assert.equal(s.pendingChoice?.effect,'shionOshiReroll');
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');
  assert.equal(s.players[0].holoPower.length,2);
  assert.equal(s.players[0].shionRerollUsesCount,0);
});

test('hBP02-005 pays one Holo Power and replaces a failed result with the reroll',()=>{
  let s=withDie(collabSetup({oshi:true}),{type:'choose',optionId:'roll'},3);
  assert.equal(s.pendingChoice?.effect,'shionOshiReroll');
  s=withDie(s,{type:'choose',optionId:'reroll'},4);
  assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');
  assert.equal(s.players[0].holoPower.length,1);
  assert.equal(s.players[0].archive.at(-1).id,'collab-power');
  assert.equal(s.players[0].shionRerollUsesTurn,s.turn);
  assert.equal(s.players[0].shionRerollUsesCount,1);
  assert.equal(s.players[0].oshiSkillTurn,s.turn);
  assert.equal(s.players[0].turnEvents.dice[0].cancelled,true);
  assert.equal(Boolean(s.players[0].turnEvents.dice[1].cancelled),false);
});

test('hBP02-005 reroll replaces an original success and cannot reroll the same die twice',()=>{
  let s=withDie(collabSetup({oshi:true,wand:true}),{type:'choose',optionId:'roll'},5);
  s=withDie(s,{type:'choose',optionId:'reroll'},2);
  assert.equal(s.pendingChoice,null);
  assert.equal(s.players[0].hand.length,0);
  assert.equal(s.players[0].shionRerollUsesCount,1);
});

test('hBP02-087 gives the Shion Oshi skill a second use while on a central 1st Shion',()=>{
  let s=withDie(collabSetup({oshi:true,wand:true}),{type:'choose',optionId:'roll'},2);
  s=withDie(s,{type:'choose',optionId:'reroll'},2);
  assert.equal(s.players[0].shionRerollUsesCount,1);

  s.phase='performance';
  fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-046').arts[0].cost);
  s.players[1].zones.center.cheer=[inst('hY05-001','move')];
  s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','recipient')]});
  s=choose(s,attack);
  assert.equal(s.pendingChoice?.effect,'shionArtRoll');
  s=withDie(s,{type:'choose',optionId:'roll'},5);
  assert.equal(s.pendingChoice?.effect,'shionOshiReroll');
  s=withDie(s,{type:'choose',optionId:'reroll'},5);
  assert.equal(s.players[0].shionRerollUsesCount,2);
  assert.equal(s.players[0].holoPower.length,0);
  assert.equal(s.pendingChoice?.effect,'opponentMoveCheerSource');
});

test('without an active hBP02-087 the Shion Oshi skill remains once per turn',()=>{
  let s=withDie(collabSetup({oshi:true}),{type:'choose',optionId:'roll'},2);
  s=withDie(s,{type:'choose',optionId:'reroll'},2);
  s.phase='performance';
  fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-046').arts[0].cost);
  s.players[1].zones.center.cheer=[inst('hY05-001','move')];
  s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','recipient')]});
  s=choose(s,attack);
  s=withDie(s,{type:'choose',optionId:'roll'},5);
  assert.equal(s.pendingChoice?.effect,'opponentMoveCheerSource');
  assert.equal(s.players[0].holoPower.length,1);
  assert.equal(s.players[0].shionRerollUsesCount,1);
});

test('hBP02-087 needs a central 1st-or-higher Shion to raise the limit',()=>{
  for(const central of ['hBP02-043','AUDIT-DUMMY']) {
    let s=collabSetup({oshi:true,wand:true,central});
    s.players[0].shionRerollUsesTurn=s.turn;
    s.players[0].shionRerollUsesCount=1;
    s=withDie(s,{type:'choose',optionId:'roll'},3);
    assert.equal(s.pendingChoice,null);
    assert.equal(s.players[0].holoPower.length,2);
  }
});

test('hBP02-047 Bloom die also receives the hBP02-005 reroll window',()=>{
  const base=cards.find(c=>c.jpName==='紫咲シオン'&&c.stage==='1st');
  let s=state(base.number);
  s.phase='main';
  s.players[0].oshi=inst('hBP02-005');
  s.players[0].holoPower=[inst('AUDIT-DUMMY','power')];
  s.players[0].hand=[inst('hBP02-047','bloom')];
  s.players[1].zones.center.cheer=[inst('hY05-001','move')];
  s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','recipient')]});
  s=choose(choose(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
  s=withDie(s,{type:'choose',optionId:'roll'},3);
  assert.equal(s.pendingChoice?.effect,'shionOshiReroll');
  s=withDie(s,{type:'choose',optionId:'reroll'},4);
  assert.equal(s.pendingChoice?.effect,'opponentMoveCheerSource');
});

test('hBP02-087 still supplies its printed Arts +10',()=>{
  let s=state('hBP02-046');
  s.players[0].zones.center.attachments=[inst('hBP02-087','wand')];
  fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-046').arts[0].cost);
  s=choose(s,attack);
  s=choose(s,{type:'choose',skip:true});
  assert.equal(s.players[1].zones.center.damage,40);
});
