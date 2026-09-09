import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a,die=1)=>applyAction(structuredClone(s),0,a,pool,()=>(die-.5)/6);
function setup(kind,fans=1){
 const n=kind==='arts'?'hBP03-034':'hBP03-031',s=state(n);
 s.players[0].zones.center.attachments=Array.from({length:fans},(_,i)=>inst('hBP03-108','fan'+i));
 s.players[1].zones.collab=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','collabTarget')]});
 if(kind==='arts')fund(s.players[0].zones.center,cards.find(c=>c.number===n).arts[0].cost);
 else {s.phase='main';s.players[0].hand=[inst('hBP07-038','bloom')];}
 return s;
}
function begin(kind,die=1,fans=1){
 let s=setup(kind,fans);
 if(kind==='arts'){s=act(s,attack);return act(s,{type:'choose',optionId:'roll'},die);}
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'},die);
}
for(const kind of ['arts','bloom'])for(const [first,last] of [[1,2],[2,1]]){
 test(kind+' reroll '+first+' to '+last+' discards old outcome',()=>{
  let s=begin(kind,first);
  assert.equal(s.pendingChoice?.effect,'haatoReroll');
  assert.equal(s.players[1].zones.center.damage,0);
  const hand=s.players[0].hand.length;
  s=act(s,{type:'choose',optionId:'fan:fan0'},last);
  assert.equal(s.pendingChoice,null);
  assert.ok(s.players[0].archive.some(c=>c.id==='fan0'));
  assert.equal(s.players[1].zones.center.damage,kind==='arts'?(last%2?60:80):(last%2?20:0));
  assert.equal(s.players[1].zones.collab.damage,kind==='arts'&&last%2?20:0);
  assert.equal(s.players[0].hand.length,hand+(kind==='bloom'&&last%2===0?1:0));
 });
}
for(const kind of ['arts','bloom'])test(kind+' accepts original result without spending fan',()=>{
 const s=act(begin(kind),{type:'choose',optionId:'accept'});
 assert.ok(!s.players[0].archive.some(c=>c.number==='hBP03-108'));
 assert.equal(s.players[1].zones.center.damage,kind==='arts'?60:20);
});
test('optional Arts roll can be declined with no die or fan use',()=>{
 const s=act(act(setup('arts'),attack),{type:'choose',skip:true});
 assert.equal(s.players[1].zones.center.damage,40);
 assert.equal(s.players[0].turnEvents.diceRollCount||0,0);
 assert.equal(s.players[0].zones.center.attachments.length,1);
});
test('two fans allow two separate rerolls and saved intermediate result',()=>{
 let s=begin('arts',1,2);
 s=act(s,{type:'choose',optionId:'fan:fan0'},2);
 assert.equal(s.players[1].zones.center.damage,0);
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',optionId:'fan:fan1'},1);
 assert.equal(s.players[1].zones.center.damage,60);
 assert.equal(s.players[1].zones.collab.damage,20);
 assert.equal(s.players[0].archive.filter(c=>c.number==='hBP03-108').length,2);
});

for(const kind of ['arts','bloom'])test(kind+' without source fan resolves immediately',()=>{
 const s=begin(kind,2,0);
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.center.damage,kind==='arts'?80:0);
});
test('only source-attached Haato fan may pay; stale and forged choices fail',()=>{
 let s=begin('arts',1,1);
 assert.throws(()=>act(s,{type:'choose',optionId:'fan:otherFan'}));
 s.players[0].zones.center.attachments=[];
 assert.throws(()=>act(s,{type:'choose',optionId:'fan:fan0'},2));
});
test('fan on a different Haato does not create a reroll window',()=>{
 let s=setup('arts',0);
 s.players[0].zones.back1=unit('hBP03-031',{stack:[inst('hBP03-031','other')],attachments:[inst('hBP03-108','otherFan')]});
 s=act(act(s,attack),{type:'choose',optionId:'roll'},1);
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.center.damage,60);
});
test('forced die override is reapplied on reroll without doubling outcome',()=>{
 let s=setup('arts');
 s.players[0].modifiers=[{kind:'dieOverride',amount:6,expiresTurn:s.turn}];
 s=act(act(s,attack),{type:'choose',optionId:'roll'},1);
 assert.equal(s.pendingChoice.meta.die,6);
 s=act(s,{type:'choose',optionId:'fan:fan0'},1);
 assert.equal(s.players[1].zones.center.damage,80);
 assert.equal(s.players[0].turnEvents.dice[0].cancelled,true);
 assert.equal(s.players[0].turnEvents.dice[1].value,6);
 assert.equal(s.players[0].turnEvents.dice[1].cancelled,undefined);
});
