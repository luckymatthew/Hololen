import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const myth=cards.find(c=>c.group==='holomem'&&c.tags.includes('#Myth'));
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup(count,other=true){const s=state('hBP02-064');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-064').arts[0].cost);s.players[0].archive=Array.from({length:count},(_,i)=>inst(myth.number,'myth'+i));if(other)s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst('hY01-001','otherCheer')]});return s;}
for(const count of [0,4,5,9,10,11])test('Ina separate transfer and bonus threshold '+count,()=>{
 let s=act(setup(count),attack);
 if(count>=5){assert.equal(s.pendingChoice?.effect,'genericMoveCheer');s=act(s,{type:'choose',skip:true});}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,count>=10?110:60);
 assert.equal(s.players[0].zones.center.cheer.length,2);
});
test('Ina transfer uses source Cheer and allows non-Myth other recipient',()=>{
 let s=act(setup(5),attack);
 assert.throws(()=>act(s,{type:'choose',cheerId:'otherCheer'}));
 s=act(s,{type:'choose',cheerId:'cheer0'});
 assert.throws(()=>act(s,{type:'choose',zone:'center'}));
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back1'});
 assert.equal(s.players[0].zones.center.cheer.length,1);assert.equal(s.players[0].zones.back1.cheer.length,2);assert.equal(s.players[1].zones.center.damage,60);
});
test('Ina +50 does not require an available transfer recipient',()=>{const s=act(setup(10,false),attack);assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,110);});
