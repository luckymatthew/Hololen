import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
const weapon=cards.find(c=>c.jpName==='古代武器');
for(const valid of [true,false])test('Ayame first-turn required attachment '+valid,()=>{
 let s=state('hBP06-035');s.phase='main';s.firstPlayer=valid?1:0;s.players[0].turnsTaken=1;
 s.players[0].zones.back1=unit('hBP06-035');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(weapon.number,'weapon')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(!valid){assert.equal(s.pendingChoice,null);return;}
 assert.equal(s.pendingChoice.min,0);assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['weapon']},pool,()=>0);
 assert.throws(()=>applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0));
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.ok(s.players[0].zones.center.attachments.some(c=>c.id==='weapon'));
});

for(const itemNumber of ['hBP01-103','hBP01-104'])test('Ayame first-turn attachment accepts item type '+itemNumber,()=>{
 let s=state('hBP06-035');s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;
 s.players[0].zones.back1=unit('hBP06-035');s.players[0].zones.center=unit('hBP06-035');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(itemNumber,'item')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice?.effect,'deckSupportToAttach');
 assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['item']);
 s=applyAction(s,0,{type:'choose',cardIds:['item']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.ok(s.players[0].zones.center.attachments.some(c=>c.id==='item'));
});
