import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const colors of [[],['綠'],['藍'],['綠','藍']])test('078 independent colors '+colors,()=>{let s=state('hBP03-078');fund(s.players[0].zones.center,['黃','黃','黃',...colors]);assert.equal(act(s,attack).players[1].zones.center.damage,50+50*colors.length)});
test('078 Bloom transfers ID1 Cheer to other unrestricted member',()=>{
 const card=cards.find(c=>c.number==='hBP03-078');let s=state(cards.find(c=>c.jpName===card.jpName&&c.stage==='1st').number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom')];
 s.players[0].zones.back1=unit('hBP03-074',{cheer:[inst('hY01-001','donor')]});s.players[0].zones.back2=unit('AUDIT-DUMMY',{cheer:[inst('hY01-001','wrong')]});
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});assert.deepEqual(s.pendingChoice.options,['donor']);s=act(s,{type:'choose',cheerId:'donor'});assert.ok(s.pendingChoice.options.includes('back2'));assert.ok(!s.pendingChoice.options.includes('back1'));s=act(s,{type:'choose',zone:'back2'});assert.equal(s.players[0].zones.back2.cheer.length,2);
});
