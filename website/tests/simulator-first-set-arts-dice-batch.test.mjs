import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
function start(n,red=true){
 const s=state(n),index=n==='hBP01-042'?1:0;
 fund(s.players[0].zones.center,cards.find(c=>c.number===n).arts[index].cost);
 if(n==='hBP01-072'&&red)s.players[0].zones.center.cheer=[inst('hY03-001')];
 s.players[1].zones.collab=unit('AUDIT-DUMMY');
 return applyAction(s,0,{...attack,artIndex:index},pool,()=>{throw Error('rolled before choice');});
}
for(const n of ['hBP01-042','hBP01-043','hBP01-072'])test(n+' decline',()=>{
 const s=start(n);assert.equal(s.pendingChoice?.effect,'firstSetArtsRoll');
 const e=applyAction(s,0,{type:'choose',skip:true},pool,()=>{throw Error('unexpected roll');});
 assert.equal(e.players[1].zones.center.damage,n==='hBP01-042'?50:n==='hBP01-043'?60:20);
 assert.equal(e.players[1].zones.collab.damage,0);
});
for(let d=1;d<=6;d++)for(const n of ['hBP01-042','hBP01-072'])test(n+' die '+d,()=>{
 const e=applyAction(start(n),0,{type:'choose',optionId:'roll'},pool,()=> (d-.5)/6);
 assert.equal(e.players[1].zones.center.damage,n==='hBP01-042'?50+d*10:20);
 assert.equal(e.players[1].zones.collab.damage,n==='hBP01-072'&&d%2===1?20:0);
});
for(const ds of [[6,6,6],[1,6,6],[1,1,6],[1,1,1]])test('count ones '+ds,()=>{
 let i=0;const e=applyAction(start('hBP01-043'),0,{type:'choose',optionId:'roll'},pool,()=> (ds[i++]-.5)/6);
 assert.equal(i,3);assert.equal(e.players[1].zones.center.damage,60+ds.filter(d=>d===1).length*10);
});
test('no red Cheer no roll',()=>assert.equal(start('hBP01-072',false).pendingChoice,null));
