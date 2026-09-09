import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(JSON.parse(JSON.stringify(s)),0,a,pool,()=>.5);
const choose=(s,a)=>act(s,{type:'choose',...a});
const deck=n=>Array.from({length:n},(_,i)=>inst('hBP01-062',`deck${i}`));
for(const purple of [false,true])for(const count of [0,1,2,3,5])test(`chef Arts: purple=${purple}, deck=${count}`,()=>{
  const s=state('hBP06-058');s.players[0].zones.center.cheer=[inst(purple?'hY05-001':'hY04-001','cheer')];
  s.players[0].mainDeck=deck(count);
  const end=act(s,attack);const drawn=purple?Math.min(1,count):0;
  assert.deepEqual(end.players[0].hand.map(c=>c.id),drawn?['deck0']:[]);
  assert.deepEqual(end.players[0].archive.map(c=>c.id),deck(count).slice(drawn,drawn+2).map(c=>c.id));
  assert.deepEqual(end.players[0].mainDeck.map(c=>c.id),deck(count).slice(drawn+2).map(c=>c.id));
  assert.equal(end.players[1].zones.center.damage,30);
});
test('purple cheer on another holomem does not enable the Arts draw',()=>{
  const s=state('hBP06-058');s.players[0].mainDeck=deck(5);
  s.players[0].zones.center.cheer=[inst('hY04-001','blue')];
  s.players[0].zones.back1=unit('hBP06-057',{cheer:[inst('hY05-001','purple')]});
  const end=act(s,attack);assert.equal(end.players[0].hand.length,0);
  assert.deepEqual(end.players[0].archive.map(c=>c.id),['deck0','deck1']);
});
for(const count of [0,1,2,4])test(`Yes Chef collab: draw three then archive two with deck=${count}`,()=>{
  const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP06-058');
  // Normal collab first moves one deck card into Holo Power.
  s.players[0].mainDeck=[inst('hBP01-062','collabPower'),...deck(count)];
  s.players[0].hand=[inst('hBP01-062','old')];
  const pending=act(s,{type:'collab',zone:'back1'});
  assert.equal(pending.pendingChoice?.effect,'handToArchive');
  const drawn=Math.min(3,count),cost=Math.min(2,drawn+1);
  assert.equal(pending.players[0].hand.length,drawn+1);
  assert.equal(pending.pendingChoice.min,cost);assert.equal(pending.pendingChoice.max,cost);
  assert.throws(()=>choose(pending,{skip:true}));
  const ids=['old',...deck(count).slice(0,drawn).map(c=>c.id)].slice(0,cost);
  const end=choose(pending,{cardIds:ids});
  assert.equal(end.players[0].hand.length,drawn+1-cost);
  assert.deepEqual(end.players[0].archive.map(c=>c.id),ids);
});
