import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pay of [false,true])test('065 paid draw once and archive-red Arts '+pay,()=>{
 const c=cards.find(c=>c.number==='hBP04-065');let s=state(cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut').number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];fund(s.players[0].zones.center,['紫','紅']);const act=a=>{s=applyAction(s,0,a,pool,()=>0)};
 act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.players[0].hand.length,0);act(pay?{type:'choose',cheerId:'cheer1'}:{type:'choose',skip:true});assert.equal(s.players[0].hand.length,pay?2:0);assert.equal(s.players[0].mainDeck.length,pay?28:30);s.phase='performance';act(attack);assert.equal(s.players[1].zones.center.damage,pay?50:30);
});
