import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const number of ['hSD13-014','hSD13-015'])test(number+' Spot cannot be Bloom base',()=>{const spot=cards.find(c=>c.number===number),first=cards.find(c=>c.jpName===spot.jpName&&c.stage==='1st');assert.ok(first);let s=state(number);s.phase='main';s.players[0].hand=[inst(first.number,'bloom')];assert.throws(()=>applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0));assert.equal(s.players[0].zones.center.stack.length,1);});
