import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0748 mandatory EN recovery excludes other cards',()=>{
 let s=state('hBP07-048');fund(s.players[0].zones.center,['紅','無色']);
 s.players[0].archive=[inst('hBP07-048','en'),inst('AUDIT-DUMMY','other'),inst('hY01-001','cheer')];
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['en']},pool,()=>0);
 assert.equal(s.players[0].hand.at(-1).id,'en');assert.equal(s.players[0].archive.length,2);
});
test('0748 empty matching archive resolves without a choice',()=>{
 let s=state('hBP07-048');fund(s.players[0].zones.center,['紅','無色']);s.players[0].archive=[inst('AUDIT-DUMMY')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice,null);
});
test('0748 Buzz DOWN loses two life',()=>{
 let s=state('AUDIT-DUMMY','hBP07-048');s.players[1].zones.center.damage=200;
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
