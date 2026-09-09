import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const turns of [1,2])test('Polka required first-turn fan Arts '+turns,()=>{const fan=cards.find(c=>c.jpName==='座員');let s=state('hBP05-031');s.firstPlayer=1;s.players[0].turnsTaken=turns;fund(s.players[0].zones.center,['無色']);s.players[0].mainDeck=[inst(fan.number,'yes')];s=applyAction(s,0,attack,pool,()=>0);if(turns===1){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'yes');}else assert.equal(s.pendingChoice,null);});
