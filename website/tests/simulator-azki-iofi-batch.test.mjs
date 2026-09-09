import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a,die=1)=>applyAction(structuredClone(s),0,a,pool,()=> (die-.5)/6);
function bloom(){
 const lower=cards.find(c=>c.jpName==='AZKi'&&c.stage==='1st');
 const s=state(lower.number);s.phase='main';s.players[0].zones.center.damage=60;
 s.players[0].hand=[inst('hBP01-047','bloom')];s.players[0].archive=[1,2,3,4].map(i=>inst('hY02-001','g'+i)).concat(inst('hY03-001','red'));
 const p=act(s,{type:'play',cardId:'bloom'});
 return applyAction(p,0,{type:'choose',zone:'center'},pool,()=>{throw Error('automatic die');});
}
test('AZKi heals before optional die and decline preserves archive',()=>{
 const s=bloom();assert.equal(s.players[0].zones.center.damage,20);
 const e=applyAction(s,0,{type:'choose',skip:true},pool,()=>{throw Error('unexpected die');});
 assert.equal(e.players[0].archive.length,5);assert.equal(e.pendingChoice,null);
});
for(let d=1;d<=6;d++)test('AZKi die '+d,()=>{
 let e=act(bloom(),{type:'choose',optionId:'roll'},d);
 if(d%2===0){assert.equal(e.pendingChoice,null);return;}
 assert.deepEqual(e.pendingChoice.selectableIds,['g1','g2','g3','g4']);assert.equal(e.pendingChoice.max,3);
 assert.throws(()=>act(e,{type:'choose',cardIds:['red']}));
 e=act(e,{type:'choose',cardIds:['g1','g2','g3']});
 while(e.pendingChoice)e=act(e,{type:'choose',zone:'center'});
 assert.equal(e.players[0].zones.center.cheer.length,3);
 assert.deepEqual(e.players[0].archive.map(c=>c.id),['g4','red']);
});
for(const companion of [null,'hBP01-055','AUDIT-DUMMY','hBP01-024'])test('Iofi companion '+companion,()=>{
 const s=state('hBP01-055');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP01-055').arts[0].cost);
 if(companion)s.players[0].zones.back1=unit(companion);
 const e=act(s,attack);assert.equal(e.players[1].zones.center.damage,companion==='hBP01-024'?150:100);
});
