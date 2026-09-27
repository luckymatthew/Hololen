import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';

test('Chloe Oshi archives the three revealed main-deck cards into this turn counter',()=>{
 const chloe=cards.find(card=>card.group==='holomem'&&card.jpName==='沙花叉クロヱ');
 let s=state(chloe.number);
 s.phase='main';
 s.players[0].oshi=inst('hBP02-004');
 s.players[0].holoPower=Array.from({length:3},(_,i)=>inst('AUDIT-DUMMY','power'+i));
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','top-1'),inst('AUDIT-DUMMY','top-2'),inst('AUDIT-DUMMY','top-3')];
 s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'oshiTopThreeMode');
 s=applyAction(s,0,{type:'choose',optionId:'archive'},pool,()=>0);
 assert.ok(['top-1','top-2','top-3'].every(id=>s.players[0].archive.some(card=>card.id===id)));
 assert.equal(s.players[0].turnEvents.deckArchived,3);
});

test('hololive Mythology counts the unselected revealed cards archived',()=>{
 const myth=cards.find(card=>card.group==='holomem'&&card.tags?.includes('#Myth'));
 let s=state();
 s.phase='main';
 s.players[0].zones.center=unit(myth.number);
 s.players[0].hand=[inst('hBP08-098','mythology')];
 s.players[0].mainDeck=Array.from({length:4},(_,i)=>inst('AUDIT-DUMMY','revealed-'+i));
 s=applyAction(s,0,{type:'play',cardId:'mythology'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'mythologyPick');
 s=applyAction(s,0,{type:'choose',cardIds:['revealed-0','revealed-1']},pool,()=>0);
 assert.equal(s.players[0].archive.filter(card=>card.id!=='mythology').length,2);
 assert.equal(s.players[0].turnEvents.deckArchived,2);
});

test('Koyori Oshi counts revealed cards placed into Archive',()=>{
 const firstStage=cards.find(card=>card.group==='holomem'&&card.stage==='1st');
 const support=cards.find(card=>card.group==='support');
 let s=state();
 s.phase='main';
 s.players[0].oshi=inst('hEB01-003');
 s.players[0].holoPower=Array.from({length:3},(_,i)=>inst('AUDIT-DUMMY','power'+i));
 s.players[0].zones.center.attachments=Array.from({length:3},(_,i)=>inst('hBP04-105','assistant-'+i));
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','debut'),inst(firstStage.number,'first-stage'),inst(support.number,'support')];
 s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);
 assert.ok(s.players[0].archive.some(card=>card.id==='debut'));
 assert.ok(s.players[0].archive.some(card=>card.id==='support'));
 assert.equal(s.players[0].turnEvents.deckArchived,2);
});

test('Chloe hBP06-055 Arts counts its revealed cards archived from the deck',()=>{
 const card=cards.find(entry=>entry.number==='hBP06-055');
 let s=state('hBP06-055');
 fund(s.players[0].zones.center,card.arts[0].cost);
 s.players[0].mainDeck=Array.from({length:4},(_,i)=>inst('AUDIT-DUMMY','revealed-'+i));
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.players[0].archive.filter(card=>card.id.startsWith('revealed-')).length,4);
 assert.equal(s.players[0].turnEvents.deckArchived,4);
});

test('hBP06-020 knockout Gift counts its two archived deck cards',()=>{
 const source=cards.find(entry=>entry.number==='hBP06-020');
 let s=state('AUDIT-DUMMY','hBP06-020');
 s.players[1].zones.center.damage=Number(source.hp)-100;
 s.players[1].zones.back1=unit('hBP06-021');
 s.players[1].mainDeck=[inst('AUDIT-DUMMY','gift-1'),inst('AUDIT-DUMMY','gift-2')];
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.pendingChoice.effect,'giftFlowGlowKo');
 s=applyAction(s,1,{type:'choose',optionId:'use'},pool,()=>0);
 assert.equal(s.players[1].archive.some(card=>card.id==='gift-1'),true);
 assert.equal(s.players[1].archive.some(card=>card.id==='gift-2'),true);
 assert.equal(s.players[1].turnEvents.deckArchived,2);
});
