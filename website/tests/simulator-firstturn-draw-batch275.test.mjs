import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const [firstPlayer,turnsTaken,valid] of [[1,1,true],[0,1,false],[1,2,false]])test('Mina-san discard then draw condition '+firstPlayer+'/'+turnsTaken,()=>{let s=state();s.phase='main';s.firstPlayer=firstPlayer;s.players[0].turnsTaken=turnsTaken;s.players[0].zones.back1=unit('hSD18-004');s.players[0].mainDeck=['power','archive','draw','keep'].map(id=>inst('AUDIT-DUMMY',id));s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.deepEqual(s.players[0].archive.map(c=>c.id),valid?['archive']:[]);assert.deepEqual(s.players[0].hand.map(c=>c.id),valid?['draw']:[]);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),valid?['keep']:['archive','draw','keep']);});
