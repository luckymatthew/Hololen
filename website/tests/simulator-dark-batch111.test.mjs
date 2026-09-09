import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const pay of [false,true])test('059 payment precedes exactly three dice '+pay,()=>{
 const c=cards.find(c=>c.number==='hBP04-059');let s=state(cards.find(x=>x.jpName===c.jpName&&x.stage==='1st').number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom'),inst('AUDIT-DUMMY','cost')];fund(s.players[0].zones.center,c.arts[0].cost);const act=a=>{s=applyAction(s,0,a,pool,()=>0)};
 act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.players[0].turnEvents.diceRollCount||0,0);assert.equal(s.players[0].hand.length,1);act(pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true});assert.equal(s.players[0].turnEvents.diceRollCount||0,pay?3:0);assert.equal(s.players[0].hand.length,pay?3:1);
 s.phase='performance';act(attack);assert.equal(s.players[1].zones.center.damage,c.arts[0].damage+(pay?30:0));
});
