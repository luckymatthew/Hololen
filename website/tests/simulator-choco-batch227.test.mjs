import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const food=cards.find(c=>['supportEvent','supportEventLimited'].includes(c.typeCode)&&c.tags.includes('#食べ物'));
const cook=cards.find(c=>c.group==='holomem'&&c.tags.includes('#料理'));
for(const count of [0,2,3,4])test('0876 food event heal threshold '+count,()=>{
 let s=state('hBP08-076');s.players[0].zones.center.damage=150;fund(s.players[0].zones.center,['紫','白','白']);
 s.players[0].archive=Array.from({length:count},(_,i)=>inst(food.number,'food'+i));s.players[0].archive.push(inst(cook.number,'wrong-type'));
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].zones.center.damage,count>=3?50:150);
});
test('0876 required groups and bottom remainder',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-076');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(cook.number,'cook'),inst(food.number,'food'),inst('AUDIT-DUMMY','rest')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 for(const id of ['cook','food']){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);s=applyAction(s,0,{type:'choose',cardIds:[id]},pool,()=>0);}
 s=applyAction(s,0,{type:'choose',cardIds:['rest']},pool,()=>0);assert.deepEqual(s.players[0].hand.map(c=>c.id),['cook','food']);assert.equal(s.players[0].mainDeck.at(-1).id,'rest');
});
