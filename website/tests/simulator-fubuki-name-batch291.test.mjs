import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const other of [true,false])test('Fubuki Arts requires another Gamers name '+other,()=>{let s=state('hBP04-014');fund(s.players[0].zones.center,['白','無色','無色']);s.players[0].zones.back1=unit(other?'hBP03-065':'hBP04-014');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,other?150:100);});
