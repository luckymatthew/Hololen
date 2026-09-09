import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const names=['hBP01-076','hBP01-079','hBP01-080','hBP01-055'];
const isolated=pool.map(c=>({...c,keyword:null,arts:[{name:'isolated attack',damage:100,cost:[],effect:''}]}));
const act=(s,a,p=0)=>applyAction(structuredClone(s),p,a,isolated,()=>.5);
for(const owner of [0,1])test('Microphone special damage victim owner '+owner,()=>{
 const s=state('hBP01-079');s.players[0].zones.center.attachments=[inst('hBP01-115')];s.players[0].cheerDeck=[inst('hY04-001','top')];
 s.players[owner].zones.back1=unit('AUDIT-DUMMY',{damage:9990});
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:'back1',sourceZone:'center',amount:30,loseLife:false,sourceName:'holder ability'}];
 let e=act(s,attack);
 if(owner===1){assert.equal(e.pendingChoice?.type,'eventCheerTarget');e=act(e,{type:'choose',zone:'center'});}
 else assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].zones.center.cheer.length,owner===1?1:0);
});
for(const n of names)test('Microphone holder '+n,()=>{
 const s=state(n);s.players[0].zones.center.attachments=[inst('hBP01-115')];s.players[0].cheerDeck=[inst('hY04-001','top')];
 s.players[1].zones.center.damage=9950;s.players[1].zones.back1=unit('AUDIT-DUMMY');
 let e=act(s,attack);
 const c=cards.find(c=>c.number===n),eligible=c.jpName==='星街すいせい'&&['1st','2nd'].includes(c.stage);
 let triggered=false;
 while(e.pendingChoice){
  if(e.pendingChoice.type==='eventCheerTarget'){triggered=true;assert.equal(e.pendingChoice.optional,false);assert.throws(()=>act(e,{type:'choose',skip:true}));e=act(e,{type:'choose',zone:'center'});}
  else e=act(e,{type:'choose',zone:'back1'},1);
 }
 assert.equal(triggered,eligible);assert.equal(e.players[0].zones.center.cheer.length,eligible?1:0);
 assert.equal(e.players[0].cheerDeck.length,eligible?0:1);
});
