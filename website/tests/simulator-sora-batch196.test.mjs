import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const stage of ['Debut','1st','2nd'])test('0817 generation-zero stage '+stage,()=>{
 let s=state('hBP08-017');fund(s.players[0].zones.center,['白','無色']);
 s.players[0].zones.back1=unit(cards.find(c=>c.group==='holomem'&&c.stage===stage&&c.tags.includes('#0期生')).number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,stage==='2nd'?60:40);
});
test('0817 required Ankimo search',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-017');
 const pick=cards.find(c=>c.jpName==='あん肝'||c.name==='あん肝');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(pick.number,'pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);assert.equal(s.players[0].hand.at(-1).id,'pick');
});
