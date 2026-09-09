import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(n){
 const c=cards.find(c=>c.number===n),lower=cards.find(x=>x.jpName===c.jpName&&x.stage===(c.stage==='2nd'?'1st':'Debut'));
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst(n,'bloom')];s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s.players[0].cheerDeck=['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001','hY06-001'].map((n,i)=>inst(n,'c'+i));
 return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
}
for(const n of ['hBP02-023','hBP02-026'])test(n+' search eligibility and unrestricted own recipient',()=>{
 let e=start(n);const c=cards.find(c=>c.number===n);
 const eligible=e.players[0].cheerDeck.filter(i=>n==='hBP02-023'||cards.find(x=>x.number===i.number).colors.some(color=>c.colors.includes(color))).map(i=>i.id);
 assert.deepEqual(e.pendingChoice.selectableIds,eligible);assert.ok(eligible.length);
 e=act(e,{type:'choose',cardIds:[eligible[0]]});assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',zone:'back1'});assert.equal(e.players[0].zones.back1.cheer[0].id,eligible[0]);assert.equal(e.players[0].cheerDeck.length,5);
});
for(const n of ['hBP02-023','hBP02-026'])test(n+' hidden search decline shuffles without losing Cheer',()=>{
 const s=start(n),before=s.players[0].cheerDeck.map(c=>c.id),e=act(s,{type:'choose',skip:true});
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].cheerDeck.length,6);assert.notDeepEqual(e.players[0].cheerDeck.map(c=>c.id),before);
});
