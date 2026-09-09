import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,dummy,inst,unit,attack,cards,fund} from './fixtures/simulator-audit.mjs';
for(const name of ['白上フブキ','Other'])for(const damage of [110,120])test('Miteiru HP '+name+' damage '+damage,()=>{
 const holder={...dummy,number:'HP-HOLDER',name,jpName:name,hp:100};
 const attacker={...dummy,number:'HP-ATTACKER',arts:[{name:'damage',damage,cost:[],effect:''}]};
 const cards=[...pool,holder,attacker];let s=state(attacker.number,holder.number);
 s.players[1].zones.center.attachments=[inst('hBP02-093','mascot')];
 s.players[1].zones.back1=unit(dummy.number);
 s=applyAction(JSON.parse(JSON.stringify(s)),0,attack,cards,()=>.5);
 if(damage<120){assert.equal(s.players[1].zones.center?.damage,damage);assert.equal(s.players[1].life.length,5);}
 else {assert.equal(s.players[1].zones.center,null);assert.equal(s.players[1].life.length,4);}
});

for(const name of ['白上フブキ','Other'])test('Miteiru back protection '+name,()=>{
 const holder={...dummy,number:'BACK-HOLDER',name,jpName:name};
 const map=[...pool,holder];let s=state('hBP01-088');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-088').arts[0].cost);
 s.players[1].zones.back1=unit(holder.number,{attachments:[inst('hBP02-093','mascot')]});
 const act=a=>{s=applyAction(s,0,a,map,()=>.25);};
 act(attack);act({type:'choose',optionId:'roll'});act({type:'choose',zone:'back1'});
 assert.equal(s.players[1].zones.back1.damage,name==='白上フブキ'?0:20);
 assert.equal(s.players[1].zones.center.damage,10);
});
