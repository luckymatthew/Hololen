import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(n){
 const c=cards.find(c=>c.number===n),lower=cards.find(c2=>c2.jpName===c.jpName&&c2.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst(n,'bloom')];s.players[0].zones.back1=unit(lower.number);
 s.players[0].mainDeck=[inst(n==='hBP02-022'?'hBP02-094':lower.number,'yes'),inst('hBP01-119','wrong'),inst('AUDIT-DUMMY','tail')];
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const n of ['hBP02-022','hBP02-032'])test(n+' exact named search',()=>{
 let e=start(n);assert.deepEqual(e.pendingChoice.selectableIds,['yes']);assert.throws(()=>act(e,{type:'choose',cardIds:['wrong']}));
 e=act(e,{type:'choose',cardIds:['yes']});assert.deepEqual(e.players[0].hand.map(c=>c.id),['yes']);assert.equal(e.players[0].mainDeck.length,2);
});
for(const n of ['hBP02-022','hBP02-032'])test(n+' hidden search decline shuffles',()=>{
 const s=start(n),before=s.players[0].mainDeck.map(c=>c.id),e=act(s,{type:'choose',skip:true});
 assert.equal(e.players[0].hand.length,0);assert.notDeepEqual(e.players[0].mainDeck.map(c=>c.id),before);
});
test('Marine named Bloom once per turn includes declined first search',()=>{
 let e=act(start('hBP02-032'),{type:'choose',skip:true});
 e.players[0].hand.push(inst('hBP02-032','second'));
 e=act(act(e,{type:'play',cardId:'second'}),{type:'choose',zone:'back1'});
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].mainDeck.length,3);assert.equal(e.players[0].hand.length,0);
});
