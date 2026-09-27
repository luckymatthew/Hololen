import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,dummy,inst,unit,attack,fund} from './fixtures/simulator-audit.mjs';
for(const [name,stage,expected] of [['森カリオペ','Debut',0],['森カリオペ','1st',1],['森カリオペ','2nd',1],['Other','2nd',0]])test('scythe hand entry '+name+' '+stage,()=>{
 const card={...dummy,number:'TOOL-HOLDER',name,jpName:name,stage};
 const map=[...pool,card];let s=state(card.number);s.phase='main';s.players[0].hand=[inst('hBP02-088','scythe')];
 const top=s.players[0].mainDeck[0].id;
 s=applyAction(s,0,{type:'play',cardId:'scythe'},map,()=>.5);
 assert.equal(s.pendingChoice?.type,'attachSupport');
 s=applyAction(JSON.parse(JSON.stringify(s)),0,{type:'choose',zone:'center'},map,()=>.5);
 assert.equal(s.players[0].archive.length,expected);
 assert.equal(s.players[0].mainDeck.length,30-expected);
 if(expected)assert.equal(s.players[0].archive[0].id,top);
 assert.equal(s.players[0].zones.center.attachments[0].id,'scythe');
 s.phase='performance';s=applyAction(s,0,attack,map,()=>.5);
 assert.equal(s.players[1].zones.center.damage,110);
});

test('Calliope Scythe counts its archived deck card toward Leona’s three-card Arts threshold',()=>{
 const card={...dummy,number:'TOOL-HOLDER',name:'Calliope 1st',jpName:'森カリオペ',stage:'1st'};
 const map=[...pool,card];
 let s=state('hBP08-020');
 s.phase='main';
 s.players[0].zones.back1=unit(card.number);
 s.players[0].turnEvents={turn:s.turn,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:2,stageReturned:0};
 fund(s.players[0].zones.center,cards.find(entry=>entry.number==='hBP08-020').arts[0].cost);
 s.players[0].hand=[inst('hBP02-088','scythe')];
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','archived-top')];

 s=applyAction(s,0,{type:'play',cardId:'scythe'},map,()=>.5);
 s=applyAction(s,0,{type:'choose',zone:'back1'},map,()=>.5);
 assert.equal(s.players[0].archive.at(-1).id,'archived-top');
 assert.equal(s.players[0].turnEvents.deckArchived,3);

 s.phase='performance';
 s=applyAction(s,0,attack,map,()=>.5);
 assert.equal(s.players[1].zones.center.damage,150);
});
