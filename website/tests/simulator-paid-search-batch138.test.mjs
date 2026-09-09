import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('063 paid different-name search '+pay,()=>{
 let s=state('hBP05-015');s.phase='main';s.players[0].zones.back1=unit('hBP05-063',{cheer:[inst('hY01-001','cost')]});
 const source=cards.find(c=>c.number==='hBP05-063'),same=cards.find(c=>c.jpName===source.jpName&&c.stage==='Debut');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('hBP05-015','sameCenter'),inst(same.number,'sameSource'),inst('hBP05-020','valid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cheerId:'cost'}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,pay?1:0);assert.equal(s.players[0].archive.some(c=>c.id==='cost'),pay);assert.equal(s.pendingChoice,null);
});
