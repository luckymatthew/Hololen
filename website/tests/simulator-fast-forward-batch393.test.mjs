import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const debut={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'FF-DEBUT',jpName:'FF',name:'FF'};
const first={...debut,number:'FF-FIRST',stage:'1st',keyword:{type:'bloom',name:'draw',effect:'抽1張牌。'}};
const deck=[...pool,debut,first];
function setup(zone='back1',entered=3){let s=state('hBP01-095');fund(s.players[0].zones.center,['藍','無色','無色']);s.players[0].zones[zone]=unit('FF-DEBUT');s.players[0].zones[zone].enteredTurn=entered;s.players[0].hand=[inst('FF-FIRST','first')];return s;}
test('Fast forward Blooms a newly entered back Debut and triggers Bloom',()=>{let s=setup();s=applyAction(s,0,attack,deck,()=>0);assert.equal(s.pendingChoice.effect,'fastForwardBloomCard');s=applyAction(s,0,{type:'choose',cardIds:['first']},deck,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},deck,()=>0);assert.equal(s.players[0].zones.back1.stack.at(-1).number,'FF-FIRST');assert.equal(s.players[0].zones.back1.bloomedTurn,3);assert.equal(s.players[0].hand.length,1);});
for(const [zone,entered] of [['back1',2],['collab',3]])test('Fast forward excludes '+zone+' entered '+entered,()=>{let s=setup(zone,entered);s=applyAction(s,0,attack,deck,()=>0);assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,1);});
