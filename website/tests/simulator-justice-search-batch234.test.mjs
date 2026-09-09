import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0846 required DOWN search '+available,()=>{
 const victim=cards.find(c=>c.group==='holomem'&&c.stage==='Debut'&&c.tags.includes('#Justice'));let s=state('AUDIT-DUMMY',victim.number);s.players[1].zones.center.damage=victim.hp-50;s.players[1].zones.collab=unit('hBP08-046');s.players[1].mainDeck=[inst(available?'hBP08-076':'AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b'),inst('AUDIT-DUMMY','c')];s=applyAction(s,0,attack,pool,()=>0);
 if(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'collab'},pool,()=>0);
 if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,1,{type:'choose',cardIds:['a']},pool,()=>0);assert.ok(s.players[1].hand.some(c=>c.id==='a'));}else assert.notDeepEqual(s.players[1].mainDeck.map(c=>c.id),['a','b','c']);
});


