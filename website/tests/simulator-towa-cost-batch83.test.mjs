import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const zone of ['center','collab'])test('054 required Collab damage '+zone,()=>{
 const s=state();s.phase='main';s.players[0].zones.back1=unit('hBP03-054');s.players[1].zones.collab=unit('AUDIT-DUMMY');
 const next=act(s,{type:'collab',zone:'back1'});assert.equal(next.pendingChoice.optional,false);
 assert.equal(act(next,{type:'choose',zone}).players[1].zones[zone].damage,20);
});
test('054 requires four purple Cheer and returns opposing Cheer after payment',()=>{
 let s=state('hBP03-054');fund(s.players[0].zones.center,['紫','紫','紫','紫','白']);s.players[1].zones.center.cheer=[inst('hY01-001','enemy')];
 s=act(s,attack);
 for(let i=0;i<4;i++){assert.equal(s.pendingChoice.optional,false);s=act(s,{type:'choose',cheerId:'cheer'+i});}
 assert.equal(s.players[0].archive.length,4);assert.equal(s.pendingChoice.effect,'artOpponentCheerBottom');
 s=act(s,{type:'choose',cheerId:'enemy'});assert.equal(s.players[1].cheerDeck.at(-1).id,'enemy');assert.equal(s.players[0].zones.center.cheer.length,1);
});
