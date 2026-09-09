import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const zone of ['center','back1'])test('Nene both sides buff from '+zone,()=>{
 let s=state('hBP07-081');s.phase='main';if(zone==='back1'){s.players[0].zones.back1=s.players[0].zones.center;s.players[0].zones.center=unit('AUDIT-DUMMY');}s.players[0].hand=[inst('hBP07-083','bloom')];s.players[0].zones.collab=unit('hBP07-083');
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone},pool,()=>0);
 const mods=u=>(u.modifiers||[]).filter(m=>m.sourceNumber==='hBP07-083');
 if(zone==='center'){assert.equal(mods(s.players[0].zones.center).reduce((n,m)=>n+m.amount,0),100);assert.equal(mods(s.players[0].zones.collab).reduce((n,m)=>n+m.amount,0),100);s.activePlayer=1;s.phase='performance';s=applyAction(s,1,attack,pool,()=>0);assert.equal(s.players[0].zones.center.damage,140);}else assert.equal(mods(s.players[0].zones.collab).length,0);
});
for(const turn of [4,5])test('Nene buff expiry turn '+turn,()=>{
 let s=state('hBP07-081');s.phase='main';s.players[0].hand=[inst('hBP07-083','bloom')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s.turn=turn;s.activePlayer=1;s.phase='performance';s=applyAction(s,1,attack,pool,()=>0);assert.equal(s.players[0].zones.center.damage,turn===4?140:100);
});
