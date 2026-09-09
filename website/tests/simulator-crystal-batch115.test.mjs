import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const pay of [false,true])test('066 whole hand draw once '+pay,()=>{
 const c=cards.find(c=>c.number==='hBP04-066');let s=state(cards.find(x=>x.jpName===c.jpName&&x.stage==='1st').number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom'),inst('AUDIT-DUMMY','a'),inst('AUDIT-DUMMY','b')];const act=a=>{s=applyAction(s,0,a,pool,()=>0)};
 act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.players[0].hand.length,2);assert.equal(s.players[0].mainDeck.length,30);act(pay?{type:'choose',cardIds:['a','b']}:{type:'choose',skip:true});assert.equal(s.players[0].hand.length,2);assert.equal(s.players[0].mainDeck.length,pay?28:30);assert.equal(s.players[0].archive.length,pay?2:0);assert.equal(s.pendingChoice,null);
});

