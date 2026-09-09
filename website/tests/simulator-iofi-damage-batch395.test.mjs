import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const c={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'ID1-DUMMY',tags:['#ID1期生']};const deck=[...pool,c];
test('Iofi moves damaged member Cheer to another ID1 after damage',()=>{let s=state('AUDIT-DUMMY','ID1-DUMMY');s.players[1].oshi=inst('hBP05-002');s.players[1].holoPower=[inst('AUDIT-DUMMY','p')];s.players[1].zones.back1=unit('ID1-DUMMY');fund(s.players[1].zones.center,['藍']);s=applyAction(s,0,attack,deck,()=>0);assert.equal(s.players[1].zones.center.damage,100);assert.equal(s.pendingChoice.effect,'iofiDamagedUse');s=applyAction(s,1,{type:'choose',optionId:'use'},deck,()=>0);s=applyAction(s,1,{type:'choose',cheerId:'cheer0'},deck,()=>0);assert.ok(!s.pendingChoice.options.includes('center'));s=applyAction(s,1,{type:'choose',zone:'back1'},deck,()=>0);assert.equal(s.players[1].zones.back1.cheer.length,1);assert.equal(s.players[1].oshiSkillTurn,3);assert.equal(s.players[1].holoPower.length,0);});
