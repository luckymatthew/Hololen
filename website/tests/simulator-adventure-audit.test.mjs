import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const buzz=cards.find(c=>c.group==='holomem'&&/buzz/i.test(c.type));assert.ok(buzz);
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function setup(hasBuzz=true){
 const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP01-096');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('AUDIT-DUMMY','wrong'),inst(hasBuzz?buzz.number:'AUDIT-DUMMY','candidate'),inst('AUDIT-DUMMY','tail')];
 return act(s,{type:'collab',zone:'back1'});
}
for(const die of [1,2,3,4,5,6,null])test('Adventure optional die '+die,()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'adventureRoll');let calls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{calls++;return (die-.5)/6;});
 if(die===null)assert.equal(calls,0);
 if(die!==null&&die%2===0){
  assert.equal(s.pendingChoice?.effect,'deckToHandShuffle');assert.deepEqual(s.pendingChoice.selectableIds,['candidate']);
  assert.throws(()=>act(s,{type:'choose',cardIds:['wrong']}));
  const before=s.players[0].mainDeck.filter(c=>c.id!=='candidate').map(c=>c.id);
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:['candidate']});
  assert.equal(s.players[0].hand[0].number,buzz.number);assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);
 }else assert.equal(s.players[0].hand.length,0);
 assert.equal(s.pendingChoice,null);
});
test('Adventure may decline conditional hidden-deck search but still shuffles',()=>{
 let s=applyAction(setup(),0,{type:'choose',optionId:'roll'},pool,()=>.25);
 const before=s.players[0].mainDeck.map(c=>c.id);s=act(s,{type:'choose',skip:true});
 assert.equal(s.players[0].hand.length,0);assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);assert.equal(s.pendingChoice,null);
});
test('Adventure empty Buzz search still shuffles and finishes',()=>{
 let s=setup(false);const before=s.players[0].mainDeck.map(c=>c.id);let calls=0;
 s=applyAction(s,0,{type:'choose',optionId:'roll'},pool,()=>calls++===0?.25:0);
 assert.equal(s.pendingChoice,null);assert.notDeepEqual(s.players[0].mainDeck.map(c=>c.id),before);
});
