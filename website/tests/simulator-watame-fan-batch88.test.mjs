import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const kind of ['yellow','other','none'])test('068 fan on yellow member condition '+kind,()=>{
 let s=state('hBP03-068');fund(s.players[0].zones.center,['黃']);s.players[0].archive=[inst('hY01-001','archived')];
 s.players[0].zones.back1=unit(kind==='yellow'?'hBP03-068':'AUDIT-DUMMY');
 if(kind!=='none')s.players[0].zones.back1.attachments=[inst(cards.find(c=>c.jpName==='わためいと'||c.name==='わためいと').number,'fan')];
 s=act(s,attack);
 if(kind==='yellow'){assert.ok(s.pendingChoice);s=act(s,{type:'choose',cardIds:['archived']});s=act(s,{type:'choose',zone:'center'});assert.equal(s.players[0].zones.center.cheer.length,2);}
 else {assert.equal(s.pendingChoice,null);assert.equal(s.players[0].archive.length,1);}
 assert.equal(s.players[1].zones.center.damage,20);
});
