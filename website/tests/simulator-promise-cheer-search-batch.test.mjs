import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a,p=pool)=>applyAction(structuredClone(s),0,a,p,()=>0);
function start(n,p=pool){
 const c=cards.find(c=>c.number===n),lower=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst(n,'bloom')];
 s.players[0].zones.back1=unit('hBP01-017');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 s.players[0].cheerDeck=['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001','hY06-001'].map((n,i)=>inst(n,'c'+i));
 return act(act(s,{type:'play',cardId:'bloom'},p),{type:'choose',zone:'center'},p);
}
for(const n of ['hBP01-090','hBP01-094'])test(n+' exact colors and mandatory recipient after selection',()=>{
 let s=start(n);assert.equal(s.pendingChoice?.effect,'genericCheerDeckPick');
 assert.deepEqual(s.pendingChoice.selectableIds,n==='hBP01-090'?['c1','c3']:['c0','c3']);
 s=act(s,{type:'choose',cardIds:[n==='hBP01-090'?'c1':'c0']});
 assert.equal(s.pendingChoice.optional,false);assert.throws(()=>act(s,{type:'choose',skip:true}));
 if(n==='hBP01-094')assert.throws(()=>act(s,{type:'choose',zone:'back2'}));
 s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer.length,1);
 assert.equal(s.players[0].cheerDeck.length,5);
});
for(const n of ['hBP01-090','hBP01-094'])test(n+' hidden choice may decline and shuffles',()=>{
 const s=start(n),before=s.players[0].cheerDeck.map(c=>c.id);
 const e=act(s,{type:'choose',skip:true});assert.equal(e.pendingChoice,null);
 assert.notDeepEqual(e.players[0].cheerDeck.map(c=>c.id),before);
});
test('same-color lookup with empty qualifying color set offers no Cheer',()=>{
 const p=pool.map(c=>c.group==='holomem'?{...c,tags:c.tags.filter(t=>t!=='#Promise')}:c);
 const s=start('hBP01-094',p);assert.equal(s.pendingChoice,null);assert.equal(s.players[0].cheerDeck.length,6);
});
