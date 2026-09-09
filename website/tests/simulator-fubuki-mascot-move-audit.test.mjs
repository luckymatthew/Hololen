import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
for(const receiver of ['AUDIT-DUMMY','hBP02-013'])for(const same of [false,true])test('Mascot receiver '+receiver+' same '+same,()=>{
 const lower=cards.find(c=>c.jpName==='白上フブキ'&&c.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-012','bloom')];
 s.players[0].zones.center.attachments=[inst('hBP01-119','moving')];
 s.players[0].zones.back1=unit(receiver,{attachments:[inst(same?'hBP01-119':'hBP01-116','existing')]});
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 e=act(e,{type:'choose',attachmentId:'moving'});
 const legal=receiver==='hBP02-013'&&!same;assert.equal(e.pendingChoice.options.includes('back1'),legal);
 if(!legal)assert.throws(()=>act(e,{type:'choose',zone:'back1'}));
 e=act(e,{type:'choose',zone:legal?'back1':'center'});
 assert.equal(e.players[0].zones[legal?'back1':'center'].attachments.filter(c=>c.id==='moving').length,1);
});
