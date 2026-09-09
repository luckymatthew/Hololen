import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const isolated=pool.map(c=>({...c,keyword:null,arts:[{name:'attack',damage:100,cost:[],effect:''}]}));
const white=cards.find(c=>c.group==='holomem'&&c.colors.includes('白')).number;
const act=(s,a)=>applyAction(structuredClone(s),0,a,isolated,()=>.5);
for(const owner of [0,1])for(const mascots of [1,2,4])test('Fubukingdom victim '+owner+' mascots '+mascots,()=>{
 const s=state(white);s.players[0].oshi=inst('hBP02-001');
 s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 for(let i=0;i<mascots;i++){
  const zone=i===0?'center':'back'+(i+1);
  if(!s.players[0].zones[zone])s.players[0].zones[zone]=unit('AUDIT-DUMMY');
  s.players[0].zones[zone].attachments=[inst('hBP01-119','mascot'+i)];
 }
 s.players[owner].zones.back1=unit('AUDIT-DUMMY',{damage:9990});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:'back1',sourceZone:'center',amount:30,loseLife:false,sourceName:'ability'}];
 const e=act(s,attack);
 if(owner===1&&mascots>=2){assert.equal(e.pendingChoice?.meta?.trigger,'fubukiMascotLife');assert.equal(e.pendingChoice.meta.rolls,Math.floor(mascots/2));}
 else assert.equal(e.pendingChoice,null);
});
test('Fubuki normal skill searches only Mascots',()=>{
 const s=state();s.phase='main';s.players[0].oshi=inst('hBP02-001');
 s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].mainDeck=[inst('hBP01-119','mascot'),inst('hBP01-122','fan'),inst('AUDIT-DUMMY','holomen')];
 let e=act(s,{type:'oshiSkill'});assert.deepEqual(e.pendingChoice.selectableIds,['mascot']);
 assert.throws(()=>act(e,{type:'choose',cardIds:['fan']}));
 e=act(e,{type:'choose',cardIds:['mascot']});assert.deepEqual(e.players[0].hand.map(c=>c.id),['mascot']);
});
