import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,attack,fund} from './fixtures/simulator-audit.mjs';
const named=(name,stage='Debut')=>cards.find(c=>c.group==='holomem'&&c.jpName===name&&c.stage===stage);
const act=(s,a,who=0)=>applyAction(structuredClone(s),who,a,pool,()=>.5);
function settleLife(s){while(s.pendingChoice?.type==='lifeCheerTarget')s=act(s,{type:'choose',zone:'back2'},1);return s;}
function hit(fan,count=2,cheers=4,life=5){
 const name=fan==='hBP03-107'?'さくらみこ':fan==='hBP03-109'?'フワワ・アビスガード':'角巻わため';
 const c=named(name),s=state('AUDIT-DUMMY',c.number);
 s.players[1].life=s.players[1].life.slice(0,life);
 s.players[1].zones.center.damage=c.hp-10;
 s.players[1].zones.center.attachments=Array.from({length:count},(_,i)=>inst(fan,'fan'+i));
 s.players[1].zones.back1=unit(c.number,{stack:[inst(c.number,'recipient')]});
 s.players[1].zones.back2=unit(c.number,{stack:[inst(c.number,'secondRecipient')]});
 const list=Array.from({length:cheers},(_,i)=>inst(fan==='hBP03-109'?'hY04-001':'hY06-001','transfer'+i));
 if(fan==='hBP03-109')s.players[1].archive=list;
 if(fan==='hBP03-112')s.players[1].zones.center.cheer=list;
 let end=act(s,attack);
 while(end.pendingChoice?.type==='lifeCheerTarget')end=act(end,{type:'choose',zone:'back2'},1);
 return end;
}
test('each 35P lets the opponent independently choose a draw',()=>{
 let s=hit('hBP03-107');const before=s.players[0].hand.length;
 assert.equal(before,0);
 assert.equal(s.pendingChoice?.effect,'koFanDraw');
 s=act(s,{type:'choose',optionId:'draw'},0);
 assert.equal(s.players[0].hand.length,before+1);
 assert.equal(s.pendingChoice?.effect,'koFanDraw');
 s=act(s,{type:'choose',skip:true},0);
 assert.equal(s.players[0].hand.length,before+1);
 s=settleLife(s);
 assert.equal(s.pendingChoice,null);
});
for(const fan of ['hBP03-109','hBP03-112'])test(fan+' copies each transfer fresh remaining Cheer',()=>{
 let s=hit(fan),moved=[];
 for(let i=0;i<2;i++){
   assert.equal(s.pendingChoice?.effect,'koFanTransferPick');
   const ids=s.pendingChoice.selectableIds;
   assert.ok(ids.every(id=>!moved.includes(id)));
   const selected=ids.slice(0,fan==='hBP03-112'?2:1);
   s=act(s,{type:'choose',cardIds:selected},1);
   assert.equal(s.pendingChoice?.effect,'koFanTransferTarget');
   s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'back1'},1);
   moved.push(...selected);
 }
 s=settleLife(s);
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.back1.cheer.length,fan==='hBP03-112'?4:2);
 assert.equal(new Set(s.players[1].zones.back1.cheer.map(c=>c.id)).size,moved.length);
});
for(const fan of ['hBP03-109','hBP03-112'])test(fan+' second fan ends cleanly after archive candidates run out',()=>{
 let s=hit(fan,2,1);
 assert.equal(s.pendingChoice?.effect,'koFanTransferPick');
 const id=s.pendingChoice.selectableIds[0];
 s=act(s,{type:'choose',cardIds:[id]},1);
 s=act(s,{type:'choose',zone:'back1'},1);
 s=settleLife(s);
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.back1.cheer.length,1);
});
for(const stage of ['Debut','1st','2nd'])test('Recorder knockout draw stage '+stage,()=>{
 const c=named('音乃瀬奏',stage);assert.ok(c);
 const s=state(c.number);
 s.players[0].zones.center.attachments=[inst('hBP03-097')];
 fund(s.players[0].zones.center,c.arts[0].cost);
 s.players[1].zones.center.damage=9990;
 s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','survivor')]});
 // Isolate the attachment's knockout condition from the source's unrelated Arts text.
 const isolated=pool.map(x=>x.number===c.number?{...x,keyword:null,arts:[{...x.arts[0],effect:''}]}:x);
 let end=applyAction(s,0,attack,isolated,()=>.5);
 while(end.pendingChoice?.type==='lifeCheerTarget')end=applyAction(end,1,{type:'choose',zone:'back1'},isolated,()=>.5);
 assert.equal(end.players[0].hand.length,stage==='Debut'?0:1);
});

for(const fan of ['hBP03-109','hBP03-112'])test(fan+' may decline first copy and use second independently',()=>{
 let s=hit(fan);
 s=act(s,{type:'choose',skip:true},1);
 assert.equal(s.pendingChoice?.effect,'koFanTransferPick');
 const ids=s.pendingChoice.selectableIds.slice(0,fan==='hBP03-112'?2:1);
 s=act(s,{type:'choose',cardIds:ids},1);
 assert.throws(()=>act(s,{type:'choose',skip:true},1));
 s=settleLife(act(s,{type:'choose',zone:'back1'},1));
 assert.equal(s.players[1].zones.back1.cheer.length,ids.length);
 assert.equal(s.pendingChoice,null);
});
test('Watame fan caps each selection at two',()=>{
 const s=hit('hBP03-112');
 assert.equal(s.pendingChoice.max,2);
 assert.throws(()=>act(s,{type:'choose',cardIds:s.pendingChoice.selectableIds.slice(0,3)},1));
});
for(const fan of ['hBP03-107','hBP03-109','hBP03-112'])test(fan+' resolves DOWN choices before final-life defeat',()=>{
 let s=hit(fan,2,4,1);
 assert.equal(s.status,'playing');
 for(let i=0;i<2;i++){
   if(fan==='hBP03-107'){
     assert.equal(s.pendingChoice?.effect,'koFanDraw');
     s=act(s,{type:'choose',optionId:'draw'},0);
   }else{
     assert.equal(s.pendingChoice?.effect,'koFanTransferPick');
     const ids=s.pendingChoice.selectableIds.slice(0,fan==='hBP03-112'?2:1);
     s=act(s,{type:'choose',cardIds:ids},1);
     s=act(s,{type:'choose',zone:'back1'},1);
   }
 }
 s=settleLife(s);
 assert.equal(s.status,'finished');
 assert.equal(s.pendingChoice,null);
 assert.equal(s.players[0].hand.length,fan==='hBP03-107'?2:0);
 if(fan!=='hBP03-107')assert.equal(s.players[1].zones.back1.cheer.length,fan==='hBP03-112'?4:2);
});
