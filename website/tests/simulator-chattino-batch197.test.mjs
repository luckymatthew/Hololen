import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const attached of [true,false])test('0819 missing Chattino gate '+attached,()=>{
 let s=state('hBP08-019');fund(s.players[0].zones.center,['白']);s.players[0].zones.back1=unit('hBP08-019');
 const c=cards.find(c=>c.jpName==='Chattino'||c.name==='Chattino');
 if(attached)s.players[0].zones.center.attachments=[inst(c.number,'existing')];
 s.players[0].mainDeck=[inst(c.number,'pick'),inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(!attached){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);
 assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[0].zones.center.attachments.length,1);assert.equal(s.players[0].zones.center.attachments[0].id,attached?'existing':'pick');
});
