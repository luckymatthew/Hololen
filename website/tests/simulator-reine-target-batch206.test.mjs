import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const name of ['クレイジー・オリー','アーニャ・メルフィッサ'])test('0832 both named 2nd targets '+name,()=>{
 const c=cards.find(c=>c.number==='hBP08-032'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='1st');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];
 s.players[0].zones.back1=unit(cards.find(c=>c.jpName===name&&c.stage==='2nd').number);
 s.players[0].zones.back2=unit(cards.find(c=>c.jpName===name&&c.stage==='Debut').number);
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);
 s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.modifiers.find(m=>m.kind==='arts').amount,70);
});
