import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function bloom(damage){
 const base=cards.find(c=>c.jpName==='一伊那尓栖'&&c.stage==='Debut');
 let s=state(base.number);s.phase='main';s.players[0].zones.center.damage=damage;
 s.players[0].zones.back1=unit(base.number,{stack:[inst(base.number,'other')],damage:30});
 s.players[0].zones.back2=unit('AUDIT-DUMMY',{damage:30});
 s.players[0].hand=[inst('hBP02-063','bloom')];
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const damage of [0,10,20,30])test('Ina Bloom heals source with damage '+damage,()=>{
 let s=bloom(damage);assert.equal(s.pendingChoice?.effect,'heal');assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>act(s,{type:'choose',skip:true}));assert.throws(()=>act(s,{type:'choose',zone:'back2'}));
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'center'});
 assert.equal(s.players[0].zones.center.damage,Math.max(0,damage-20));assert.equal(s.players[0].zones.back1.damage,30);
});
test('Ina Bloom may choose another Myth',()=>{const s=act(bloom(30),{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.damage,10);assert.equal(s.players[0].zones.center.damage,30);});
