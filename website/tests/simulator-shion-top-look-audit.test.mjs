import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const source=cards.find(c=>c.number==='hBP02-045'),base=cards.find(c=>c.jpName===source.jpName&&c.stage==='Debut');
const blue=cards.find(c=>c.group==='holomem'&&c.colors.includes('藍')),purple=cards.find(c=>c.group==='holomem'&&c.colors.includes('紫'));
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup(){
 let s=state(base.number);s.phase='main';s.players[0].hand=[inst(source.number,'bloom')];
 s.players[0].mainDeck=[inst(blue.number,'blue'),inst(purple.number,'purple'),inst('AUDIT-DUMMY','wrong'),inst('AUDIT-DUMMY','tail')];
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const pick of ['blue','purple',null])test('Shion blue-or-purple private look '+pick,()=>{
 let s=setup();assert.equal(s.pendingChoice?.effect,'genericTopLook');assert.deepEqual(s.pendingChoice.selectableIds,['blue','purple']);
 assert.throws(()=>act(s,{type:'choose',cardIds:['wrong']}));
 s=act(s,pick?{type:'choose',cardIds:[pick]}:{type:'choose',skip:true});
 const rest=['blue','purple','wrong'].filter(id=>id!==pick).reverse();
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:rest});
 assert.equal(s.pendingChoice,null);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),['tail',...rest]);assert.deepEqual(s.players[0].hand.map(c=>c.id),pick?[pick]:[]);
});
