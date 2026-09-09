import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function setup({magic=true,costMagic=false}={}){
 const base=cards.find(c=>c.jpName==='紫咲シオン'&&c.stage==='Debut');
 let s=state(base.number);s.phase='main';
 s.players[0].hand=[inst('hBP02-046','bloom'),inst(costMagic?'hBP02-079':'AUDIT-DUMMY','cost')];
 s.players[0].archive=[inst('AUDIT-DUMMY','ineligible'),...(magic?[inst('hBP02-069','magicHolomen'),inst('hBP02-079','magicSupport')]:[])];
 s=act(s,{type:'play',cardId:'bloom'});return act(s,{type:'choose',zone:'center'});
}
for(const id of ['magicHolomen','magicSupport'])test('paid Shion recovers exactly one #Magic '+id,()=>{
 let s=setup();s=act(s,{type:'choose',cardIds:['cost']});
 assert.equal(s.pendingChoice?.effect,'archiveToHand');assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 assert.throws(()=>act(s,{type:'choose',cardIds:['ineligible']}));
 assert.throws(()=>act(s,{type:'choose',cardIds:['magicHolomen','magicSupport']}));
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:[id]});
 assert.equal(s.players[0].hand.length,1);assert.equal(s.players[0].hand[0].id,id);
 assert.ok(s.players[0].archive.some(c=>c.id==='cost'));
});
test('declining Shion cost never recovers',()=>{const s=act(setup(),{type:'choose',skip:true});assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand[0].id,'cost');});
test('paid Shion ends cleanly with no Magic',()=>{const s=act(setup({magic:false}),{type:'choose',cardIds:['cost']});assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,0);});
test('newly archived Magic payment can itself be recovered',()=>{let s=act(setup({magic:false,costMagic:true}),{type:'choose',cardIds:['cost']});assert.equal(s.pendingChoice.optional,false);s=act(s,{type:'choose',cardIds:['cost']});assert.equal(s.players[0].hand[0].id,'cost');});

for(const die of [1,2,3,4,5,6,null])test('Shion Arts optional roll '+die,async()=>{
 const {unit,fund,attack}=await import('./fixtures/simulator-audit.mjs');
 let s=state('hBP02-046');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-046').arts[0].cost);
 s.players[1].zones.center.cheer=[inst('hY05-001','move')];
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','other')]});
 s=act(s,attack);assert.equal(s.pendingChoice?.effect,'shionArtRoll');
 let rolls=0;
 s=applyAction(s,0,die===null?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>{rolls++;return (die-.5)/6;});
 if(die===null)assert.equal(rolls,0);
 if(die>=5){
  assert.equal(s.pendingChoice?.effect,'opponentMoveCheerSource');assert.throws(()=>act(s,{type:'choose',skip:true}));
  s=act(s,{type:'choose',cheerId:'move'});s=act(s,{type:'choose',zone:'back1'});
  assert.equal(s.players[1].zones.back1.cheer[0].id,'move');
 }else assert.equal(s.players[1].zones.center.cheer.length,1);
 assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,30);
});
