import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(number,{fan=true,real=false,otherFan=false,oshi=true}={}){
 const bloom=number==='hBP03-019',collab=number==='hBP03-017';
 const s=state(bloom?'hBP03-016':number);s.phase='main';
 s.players[0].oshi=inst(oshi?'hBP03-002':'AUDIT-OSHI');
 const source=s.players[0].zones.center;
 source.attachments=fan?[inst('hBP03-106','fan'),inst('hBP03-106','spare')]:[];
 if(collab){s.players[0].zones.back1=source;s.players[0].zones.center=unit('AUDIT-DUMMY',{damage:20});}
 else s.players[0].zones.back1=unit('hBP03-016',{stack:[inst('hBP03-016','other')],cheer:real?[inst('hY02-001','real')]:[],attachments:otherFan?[inst('hBP03-106','otherFan')]:[]});
 if(collab)s.players[0].cheerDeck=real?[inst('hY02-001','real')]:[];
 if(bloom){s.players[0].hand=[inst(number,'bloom')];return act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});}
 if(collab)return act(s,{type:'collab',zone:'back1'});
 s.phase='performance';fund(source,cards.find(c=>c.number===number).arts[0].cost);
 return act(s,attack);
}
for(const number of ['hBP03-017','hBP03-019','hBP03-021','hBP05-028']){
 test(number+' can substitute its own SSRB with no eligible Cheer',()=>{
   let s=start(number);
   assert.equal(s.pendingChoice?.effect,'botanCheerPayment');
   const option=s.pendingChoice.modeOptions.find(o=>o.kind==='ssrb'&&o.cardId==='fan');
   assert.ok(option);
   s=act(s,{type:'choose',optionId:option.id});
   if(number==='hBP03-017')s=act(s,{type:'choose',zone:'center'});
   else s=act(s,{type:'choose',zone:'center'});
   assert.ok(s.players[0].archive.some(c=>c.id==='fan'));
   assert.ok(!s.players[0].archive.some(c=>c.id==='spare'));
   assert.equal(s.players[0].turnEvents.cheerArchived,0);
   assert.equal(s.pendingChoice,null);
   if(number==='hBP03-017')assert.equal(s.players[0].zones.center.damage,10);
   else assert.equal(s.players[1].zones.center.damage,number==='hBP03-019'?30:number==='hBP03-021'?150:70);
 });
 test(number+' can decline the optional ability without spending SSRB',()=>{
   const s=act(start(number),{type:'choose',skip:true});
   assert.ok(!s.players[0].archive.some(c=>c.number==='hBP03-106'));
   assert.equal(s.pendingChoice,null);
   if(number==='hBP03-021'||number==='hBP05-028')assert.equal(s.players[1].zones.center.damage,number==='hBP03-021'?110:40);
 });
 test(number+' keeps real Cheer payment available alongside SSRB',()=>{
   let s=start(number,{real:true});
   assert.equal(s.pendingChoice?.effect,'botanCheerPayment');
   const option=s.pendingChoice.modeOptions.find(o=>o.kind!=='ssrb'&&o.cardId==='real');
   assert.ok(option);
   s=act(s,{type:'choose',optionId:option.id});
   s=act(s,{type:'choose',zone:'center'});
   assert.ok(s.players[0].archive.some(c=>c.id==='real'));
   assert.ok(!s.players[0].archive.some(c=>c.number==='hBP03-106'));
   assert.equal(s.players[0].turnEvents.cheerArchived,1);
 });
}
test('another Botan SSRB cannot pay the source Bloom without back Cheer',()=>{
 const s=start('hBP03-019',{fan:false,otherFan:true});
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.center.damage,0);
});
test('Botan Oshi requirements still apply to Collab and Arts',()=>{
 for(const n of ['hBP03-017','hBP03-021'])assert.notEqual(start(n,{oshi:false}).pendingChoice?.effect,'botanCheerPayment');
});

for(const number of ['hBP03-017','hBP03-019','hBP03-021','hBP05-028'])test(number+' works with real Cheer and no SSRB',()=>{
 let s=start(number,{fan:false,real:true});
 assert.ok(s.pendingChoice.modeOptions.every(o=>o.kind!=='ssrb'));
 const option=s.pendingChoice.modeOptions.find(o=>o.cardId==='real');
 s=act(s,{type:'choose',optionId:option.id});
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone:'center'});
 assert.ok(s.players[0].archive.some(c=>c.id==='real'));
});
test('SSRB selection rejects another holder and a stale removed fan',()=>{
 const s=start('hBP03-019',{otherFan:true});
 assert.throws(()=>act(s,{type:'choose',optionId:'ssrb:otherFan'}));
 s.players[0].zones.center.attachments=s.players[0].zones.center.attachments.filter(c=>c.id!=='fan');
 assert.throws(()=>act(s,{type:'choose',optionId:'ssrb:fan'}));
});
test('SSRB payment and mandatory damage selection survive a saved room',()=>{
 let s=JSON.parse(JSON.stringify(start('hBP03-021')));
 s=act(s,{type:'choose',optionId:'ssrb:fan'});
 assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'center'});
 assert.equal(s.players[1].zones.center.damage,150);
});
test('SSRB payment consumes the named once-per-turn Bloom allowance',()=>{
 let s=start('hBP03-019');
 s=act(act(s,{type:'choose',optionId:'ssrb:fan'}),{type:'choose',zone:'center'});
 s.players[0].zones.back2=unit('hBP03-016',{stack:[inst('hBP03-016','second')],attachments:[inst('hBP03-106','secondFan')]});
 s.players[0].hand=[inst('hBP03-019','secondBloom')];
 s=act(act(s,{type:'play',cardId:'secondBloom'}),{type:'choose',zone:'back2'});
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.center.damage,30);
 assert.ok(s.players[0].zones.back2.attachments.some(c=>c.id==='secondFan'));
});
