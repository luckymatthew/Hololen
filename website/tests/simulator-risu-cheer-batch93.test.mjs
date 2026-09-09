import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const color of ['hY02-001','hY06-001'])test('076 green/yellow Cheer to unrestricted member '+color,()=>{
 const c=cards.find(c=>c.number==='hBP03-076');let s=state(cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut').number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst(color,'valid'),inst('hY03-001','wrong')];
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});assert.deepEqual(s.pendingChoice.selectableIds,['valid']);s=act(s,{type:'choose',cardIds:['valid']});assert.ok(s.pendingChoice.options.includes('back1'));s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer[0].id,'valid');assert.equal(s.players[0].cheerDeck[0].id,'wrong');
});

