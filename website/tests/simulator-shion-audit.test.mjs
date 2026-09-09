import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a,die=4)=>applyAction(structuredClone(s),0,a,pool,()=>(die-.5)/6);
function bloom(){
 const base=cards.find(c=>c.jpName==='紫咲シオン'&&c.stage==='1st');
 let s=state(base.number);s.phase='main';s.players[0].hand=[inst('hBP02-047','bloom')];
 s.players[1].zones.center.cheer=[inst('hY05-001','move')];
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','recipient')]});
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(let die=1;die<=6;die++)test('Shion Bloom die '+die,()=>{
 let s=bloom();assert.equal(s.pendingChoice?.effect,'shionBloomRoll');
 s=act(s,{type:'choose',optionId:'roll'},die);
 if(die<4){assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.cheer.length,1);return;}
 assert.equal(s.pendingChoice?.effect,'opponentMoveCheerSource');
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',cheerId:'move'});
 assert.throws(()=>act(s,{type:'choose',zone:'center'}));
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back1'});
 assert.equal(s.players[1].zones.center.cheer.length,0);
 assert.equal(s.players[1].zones.back1.cheer[0].id,'move');
});
test('Shion can decline roll without invoking randomness',()=>{
 const s=bloom();let calls=0;
 const end=applyAction(s,0,{type:'choose',skip:true},pool,()=>{calls++;return .5;});
 assert.equal(calls,0);assert.equal(end.pendingChoice,null);
});
for(const count of [0,1,3])test('Shion Arts scales BOTH targets from CENTER Cheer '+count,()=>{
 const s=state('hBP02-047');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-047').arts[0].cost);
 s.players[1].zones.center.cheer=Array.from({length:count},(_,i)=>inst('hY05-001','center'+i));
 s.players[1].zones.collab=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','collab')],cheer:[inst('hY05-001','collabCheer')]});
 const end=act(s,attack);
 assert.equal(end.players[1].zones.center.damage,80+20*count);
 assert.equal(end.players[1].zones.collab.damage,20*count);
});
