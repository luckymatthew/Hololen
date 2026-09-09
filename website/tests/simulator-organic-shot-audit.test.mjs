import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const supportTypes=['supportTool','supportMascot','supportFan'];
const isolated=[...pool,...supportTypes.map(type=>({number:type,typeCode:type,group:'support',abilityText:''}))];
const act=(s,a)=>applyAction(structuredClone(s),0,a,isolated,()=>.5);
function setup(types,other=false){
 const s=state('hBP02-034');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-034').arts[1].cost);
 s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s.players[0].zones[other?'back1':'center'].attachments=types.map(type=>inst(type));
 s.players[1].zones.collab=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','collab')]});
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back')]});
 return act(s,{...attack,artIndex:1});
}
for(const types of [[],['supportFan'],['supportTool'],['supportMascot'],['supportTool','supportMascot']])test('Organic Shot attachment '+types.join('+'),()=>{
 let s=setup(types);const enabled=types.some(t=>t!=='supportFan');
 if(enabled){
  assert.equal(s.pendingChoice?.effect,'specialDamage');assert.throws(()=>act(s,{type:'choose',skip:true}));assert.throws(()=>act(s,{type:'choose',zone:'back1'}));
  s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'collab'});
 }
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,80);assert.equal(s.players[1].zones.collab.damage,enabled?30:0);
});
test('Organic Shot ignores tool on other holder',()=>{const s=setup(['supportTool'],true);assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.collab.damage,0);});
test('Organic Shot may choose center for special damage',()=>{const s=act(setup(['supportMascot']),{type:'choose',zone:'center'});assert.equal(s.players[1].zones.center.damage,110);assert.equal(s.players[1].zones.collab.damage,0);});
