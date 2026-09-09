import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const archive of [true,false])test('Kiara reveal then archive choice '+archive,()=>{
 const debut=cards.find(c=>c.jpName==='小鳥遊キアラ'&&c.stage==='Debut');let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP03-036','bloom')];s.players[0].mainDeck=[inst(debut.number,'k1'),inst(debut.number,'k2'),inst('AUDIT-DUMMY','other')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['k1','k2']},pool,()=>0);assert.equal(s.players[0].archive.length,0);s=applyAction(s,0,{type:'choose',optionId:archive?'archive':'keep'},pool,()=>0);assert.equal(s.players[0].archive.length,archive?2:0);assert.equal(s.players[0].mainDeck.length,archive?1:3);
});
