import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const present of [true,false])test('0837 Fuwawa required damage '+present,()=>{
 const c=cards.find(c=>c.number==='hBP08-037'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];
 if(present)s.players[0].zones.back1=unit(cards.find(c=>c.group==='holomem'&&c.jpName==='フワワ・アビスガード').number);
 s.players[1].zones.collab=unit('AUDIT-DUMMY');s.players[1].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(present){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center','collab']);s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);}
 else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.collab.damage,present?20:0);assert.equal(s.players[1].zones.center.damage,0);
});
