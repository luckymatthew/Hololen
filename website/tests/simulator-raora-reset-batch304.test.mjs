import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const enabled of [true,false])test('Raora SP prevents resting on reset return '+enabled,()=>{const raora=cards.find(c=>c.jpName==='ラオーラ・パンテーラ'&&c.group==='holomem');let s=state();s.phase='main';s.players[0].oshi=inst('hBP06-001');s.players[0].holoPower=[inst('AUDIT-DUMMY','hp')];s.players[0].zones.collab=unit(raora.number);if(enabled)s=applyAction(s,0,{type:'spOshiSkill'},pool,()=>0);s.activePlayer=1;s.phase='performance';s=applyAction(s,1,{type:'advance'},pool,()=>0);assert.equal(s.players[0].zones.collab,null);assert.equal(s.players[0].zones.back1.rested,!enabled);});

