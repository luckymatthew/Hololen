import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const buzz of [true,false])test('0730 heal from Buzz '+buzz,()=>{
 const card=cards.find(c=>c.number==='hBP07-030'),prior=cards.find(c=>c.jpName===card.jpName&&c.stage==='1st'&&c.type.toUpperCase().includes('BUZZ')===buzz);
 let s=state(prior.number);s.phase='main';s.players[0].zones.center.damage=110;s.players[0].hand=[inst(card.number,'bloom')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(buzz){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[0].zones.center.damage,buzz?10:110);assert.equal(s.pendingChoice,null);
});
