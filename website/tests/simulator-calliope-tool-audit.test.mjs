import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,dummy,inst,attack} from './fixtures/simulator-audit.mjs';
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
