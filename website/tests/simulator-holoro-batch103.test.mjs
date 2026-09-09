import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(s,0,a,pool,()=>0);
for(const name of ['クレイジー・オリー','アーニャ・メルフィッサ','none'])test('027 required HOLORO recipient '+name,()=>{
 let s=state(cards.find(c=>c.jpName==='パヴォリア・レイネ'&&c.stage==='Debut').number);s.phase='main';s.players[0].hand=[inst('hBP04-027','bloom')];s.players[0].cheerDeck=[inst('hY01-001','top')];
 if(name!=='none')s.players[0].zones.back1=unit(cards.find(c=>c.group==='holomem'&&c.jpName===name).number);
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 if(name!=='none'){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer[0].id,'top');}
 else assert.equal(s.players[0].cheerDeck.length,1);
 assert.equal(s.pendingChoice,null);
});
