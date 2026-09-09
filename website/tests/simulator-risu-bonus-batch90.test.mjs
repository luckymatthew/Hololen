import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const names of [[],['アイラニ・イオフィフティーン'],['ムーナ・ホシノヴァ'],['アイラニ・イオフィフティーン','ムーナ・ホシノヴァ']])test('074 independent bonuses '+names.join(','),()=>{
 const s=state('hBP03-074');fund(s.players[0].zones.center,['無色']);
 names.forEach((name,i)=>{s.players[0].zones['back'+(i+1)]=unit(cards.find(c=>c.group==='holomem'&&c.jpName===name).number)});
 const next=applyAction(s,0,attack,pool,()=>0);assert.equal(next.players[1].zones.center.damage,20+names.length*10);
});
