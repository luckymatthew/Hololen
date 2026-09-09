import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
const prior=cards.find(c=>c.jpName==='アキ・ローゼンタール'&&c.stage==='1st').number;
const tool=cards.find(c=>c.typeCode==='supportTool').number;
for(const pay of [true,false])test('Aki tool cost '+pay,()=>{
 let s=state(prior);s.phase='main';s.players[0].zones.center.attachments=[inst(tool,'tool')];s.players[0].hand=[inst('hBP05-027','bloom')];
 s.players[0].mainDeck=[inst(tool,'searchTool'),inst('AUDIT-DUMMY','member'),inst('hY01-001','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'genericKeywordAttachmentCost');
 s=applyAction(s,0,pay?{type:'choose',attachmentId:'tool'}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['searchTool','member']);s=applyAction(s,0,{type:'choose',cardIds:['searchTool']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='searchTool'));}
 assert.equal(s.players[0].archive.some(c=>c.id==='tool'),pay);assert.equal(s.pendingChoice,null);
});
