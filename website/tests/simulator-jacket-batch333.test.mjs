import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const buzz of [true,false])test('jacket blocks opponent main HP setting only on Buzz '+buzz,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.type.includes('Buzz'));let s=state('AUDIT-DUMMY',buzz?target.number:'AUDIT-DUMMY');s.phase='main';s.players[0].oshi=inst('hBP01-001');s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','p'+i));s.players[1].zones.center.attachments=[inst('hBP06-097')];
 s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.equal(s.players[1].zones.center.damage===0,buzz);
});
for(const phase of ['main','performance'])test('jacket special damage phase '+phase,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.type.includes('Buzz'));let s=state('AUDIT-DUMMY',target.number);s.phase=phase;s.players[1].zones.center.attachments=[inst('hBP06-097')];
 s.pendingChoice={type:'stageTarget',playerIndex:0,targetPlayerIndex:1,options:['center'],effect:'specialDamage',optional:false,meta:{amount:30,sourceZone:'center',loseLife:true}};
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,phase==='main'?0:30);
});
for(const owner of [0,1])test('jacket healing source owner '+owner,()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.type.includes('Buzz'));let s=state(target.number,target.number);s.phase='main';s.players[owner].zones.center.attachments=[inst('hBP06-097')];s.players[owner].zones.center.damage=40;
 s.pendingChoice={type:'stageTarget',playerIndex:0,targetPlayerIndex:owner,options:['center'],effect:'heal',optional:false,meta:{amount:20}};
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[owner].zones.center.damage,owner===1?40:20);
});
test('jacket does not block own main-phase special damage',()=>{
 const target=cards.find(c=>c.group==='holomem'&&c.type.includes('Buzz'));let s=state(target.number);s.phase='main';s.players[0].zones.center.attachments=[inst('hBP06-097')];
 s.pendingChoice={type:'stageTarget',playerIndex:0,targetPlayerIndex:0,options:['center'],effect:'specialDamage',optional:false,meta:{amount:30,sourceZone:'center',loseLife:true}};
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.damage,30);
});
