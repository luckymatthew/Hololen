import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const location of ['back1','collab','none']) test('055 song condition '+location,()=>{
 const s=state('hBP03-055');fund(s.players[0].zones.center,['紫','無色']);
 s.players[1].zones.collab=unit('AUDIT-DUMMY');
 if(location!=='none')s.players[0].zones[location]=unit(cards.find(c=>c.group==='holomem'&&c.tags.includes('#歌')).number);
 const next=act(s,{...attack,artIndex:1});
 assert.equal(next.players[1].zones.collab.damage,location==='back1'?20:0);
 assert.equal(next.players[1].zones.center.damage,50);
});
for(const zone of ['center','collab']) test('056 mandatory damage '+zone,()=>{
 const s=state('hBP03-056');fund(s.players[0].zones.center,['紫']);
 s.players[1].zones.collab=unit('AUDIT-DUMMY');
 const next=act(s,attack);assert.equal(next.pendingChoice.optional,false);
 const done=act(next,{type:'choose',zone});
 assert.equal(done.players[1].zones.center.damage,zone==='center'?60:30);
 assert.equal(done.players[1].zones.collab.damage,zone==='collab'?30:0);
});
