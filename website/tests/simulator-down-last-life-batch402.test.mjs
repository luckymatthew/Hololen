import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const use of [false,true])test('Towa final life waits for DOWN choice '+use,()=>{
 const c={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'LAST-TOWA',jpName:'常闇トワ'};const deck=[...pool,c];let s=state('AUDIT-DUMMY',c.number);s.players[1].oshi=inst('hBP03-005');s.players[1].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[1].life=[inst('hY01-001','last')];s.players[1].zones.center.damage=9990;s.players[1].zones.back1=unit('AUDIT-DUMMY');s.players[0].zones.center.cheer=[inst('hY01-001','a')];s=applyAction(s,0,attack,deck,()=>0);assert.equal(s.pendingChoice.meta.trigger,'towaDown');assert.equal(s.status,'playing');assert.equal(s.players[1].life.length,1);
 s=applyAction(s,1,use?{type:'choose',optionId:'use'}:{type:'choose',skip:true},deck,()=>0);
 if(use){assert.equal(s.pendingChoice.effect,'towaDownBottom');assert.equal(s.players[1].life.length,1);s=applyAction(s,1,{type:'choose',cardIds:['a']},deck,()=>0);assert.equal(s.players[0].cheerDeck.at(-1).id,'a');}
 assert.equal(s.players[1].life.length,0);assert.equal(s.pendingChoice.type,'lifeCheerTarget');s=applyAction(s,1,{type:'choose',zone:'back1'},deck,()=>0);assert.equal(s.status,'finished');assert.equal(s.winner,0);
});
