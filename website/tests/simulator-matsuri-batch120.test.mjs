import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const die of [0,1,4])test('082 no duplicate Bloom dice '+die,()=>{
 const c=cards.find(c=>c.number==='hBP04-082');const base=cards.find(x=>x.jpName===c.jpName&&x.stage==='1st');let s=state(base.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].zones.back1=unit(base.number);s.players[0].cheerDeck=[inst('hY01-001','top'),inst('hY01-001','next')];const act=a=>{s=applyAction(s,0,a,pool,()=>(die-.5)/6)};
 act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.players[0].turnEvents.diceRollCount||0,0);act(die?{type:'choose',optionId:'1'}:{type:'choose',skip:true});if(die>=4)act({type:'choose',zone:'center'});assert.equal(s.players[0].turnEvents.diceRollCount||0,die?1:0);assert.equal(s.players[0].hand.length,0);assert.equal(s.players[0].zones.center.cheer.length,die>=4?1:0);assert.equal(s.pendingChoice,null);
});


