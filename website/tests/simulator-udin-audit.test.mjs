import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(JSON.parse(JSON.stringify(s)),0,a,pool,()=>.5);
const choose=(s,a)=>act(s,{type:'choose',...a});
function bloom({hand=0,deck=5,source='hBP02-048',target='hBP02-050',attached=true}={}){
  const s=state(source);s.phase='main';
  s.players[0].oshi=inst('hBP01-005');s.players[0].holoPower=[inst('hBP01-062','power')];
  s.players[0].zones.center.attachments=attached?[inst('hBP02-097','udin')]:[];
  s.players[0].hand=[inst(target,'bloom'),...Array.from({length:hand},(_,i)=>inst('hBP01-062',`hand${i}`))];
  s.players[0].mainDeck=Array.from({length:deck},(_,i)=>inst('hBP01-062',`draw${i}`));
  return choose(act(s,{type:'play',cardId:'bloom'}),{zone:'center'});
}
test('UDIN: empty hand must archive the newly drawn card',()=>{
  const s=bloom();assert.equal(s.pendingChoice?.effect,'handToArchive');
  assert.deepEqual(s.pendingChoice.selectableIds,['draw0']);
  const end=choose(s,{cardIds:['draw0']});
  assert.equal(end.players[0].hand.length,0);assert.equal(end.players[0].mainDeck.length,4);
  assert.equal(end.players[0].archive.at(-1).id,'draw0');
});
test('UDIN: with existing cards the newly drawn card is also selectable',()=>{
  const s=bloom({hand:2});assert.deepEqual(s.pendingChoice.selectableIds,['hand0','hand1','draw0']);
  const end=choose(s,{cardIds:['draw0']});assert.deepEqual(end.players[0].hand.map(c=>c.id),['hand0','hand1']);
});
test('UDIN: may archive an existing hand card instead',()=>{
  const end=choose(bloom({hand:1}),{cardIds:['hand0']});assert.equal(end.players[0].hand[0].id,'draw0');
});
test('UDIN: required archive cannot be skipped',()=>{
  const s=bloom();assert.equal(s.pendingChoice?.effect,'handToArchive');
  assert.throws(()=>choose(s,{skip:true}));
});
test('UDIN: an empty deck still permits archiving an existing card',()=>{
  const end=choose(bloom({deck:0,hand:1}),{cardIds:['hand0']});
  assert.equal(end.players[0].hand.length,0);assert.equal(end.players[0].archive.at(-1).id,'hand0');
});
test('UDIN: no deck and no hand resolves without a choice',()=>assert.equal(bloom({deck:0}).pendingChoice,null));
test('UDIN: no attachment does not draw or discard',()=>{
  const s=bloom({attached:false});assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,5);
});
test('UDIN: non-Ollie holder does not trigger the Bloom ability',()=>{
  const s=bloom({source:'hBP01-056',target:'hBP01-059'});
  assert.equal(s.pendingChoice,null);assert.equal(s.players[0].mainDeck.length,5);
});
test('UDIN on Ollie: archive does not offer Lui replacement',()=>{
  const s=bloom({hand:1});assert.equal(s.pendingChoice?.effect,'handToArchive');
  const end=choose(s,{cardIds:['hand0']});assert.equal(end.players[0].holoPower.length,1);
});
for(const number of ['hBP02-050','hBP01-062'])test(`UDIN: +10 Arts applies on ${number}`,()=>{
  const s=state(number);const c=cards.find(c=>c.number===number);
  s.players[0].zones.center.attachments=[inst('hBP02-097','udin')];fund(s.players[0].zones.center,c.arts[0].cost);
  let end=act(s,attack);if(end.pendingChoice)end=choose(end,{skip:true});
  assert.equal(end.players[1].zones.center.damage,c.arts[0].damage+10);
});
