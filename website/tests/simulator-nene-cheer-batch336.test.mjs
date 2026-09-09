import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
test('Nene mandatory cheer uses stage fifth-generation colors',()=>{
 const debut=cards.find(c=>c.jpName==='桃鈴ねね'&&c.stage==='Debut');const blue=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#5期生')&&c.colors?.includes('藍'));
 let s=state(debut.number);s.phase='main';s.players[0].zones.back1=unit(blue.number);s.players[0].hand=[inst('hBP04-085','bloom')];s.players[0].cheerDeck=[inst('hY04-001','blue')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.cheer[0].id,'blue');
});
