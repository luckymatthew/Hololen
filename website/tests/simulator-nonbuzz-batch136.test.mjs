import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP05-062','hBP05-071'])test(n+' required nonBuzz first search',()=>{
 const card=cards.find(c=>c.number===n),tag=n==='hBP05-062'?'#歌':'#ゲーマーズ',count=n==='hBP05-062'?2:1;
 const prior=cards.find(c=>c.jpName===card.jpName&&c.stage==='1st');
 const valid=cards.find(c=>c.stage==='1st'&&c.tags.includes(tag)&&!c.type.toUpperCase().includes('BUZZ'));
 const buzz=cards.find(c=>c.stage==='1st'&&c.tags.includes(tag)&&c.type.toUpperCase().includes('BUZZ'));
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(n,'bloom')];s.players[0].mainDeck=[...Array.from({length:count},(_,i)=>inst(valid.number,'valid'+i)),inst(buzz.number,'buzz'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,count);assert.equal(s.pendingChoice.cards.length,count);
 s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'valid'+i)},pool,()=>0);assert.equal(s.players[0].hand.length,count);assert.equal(s.pendingChoice,null);
});
