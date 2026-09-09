import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack,fund } from './fixtures/simulator-audit.mjs';
const card=n=>cards.find(c=>c.number===n);
const zeroPool=pool.map(c=>c.number===dummy.number?{...c,arts:[{...c.arts[0],damage:0}]}:c);
const msgs=s=>s.log.map(e=>typeof e==='string'?e:e.message).reverse();
const unique=(n,id,opts={})=>unit(n,{stack:[inst(n,id)],...opts});
function settle(s,p=pool){for(let i=0;s.pendingChoice&&i<20;i++){
 assert.equal(s.pendingChoice.type,'lifeCheerTarget');
 s=applyAction(s,s.pendingChoice.playerIndex,{type:'choose',zone:'back1'},p);
}return s;}
function queueHit({kind='arts',amount=40,damage=0,zone='center',support=true,own=false,iroha=false,target='hBP07-029',giftZone='collab',life=5}={}){
 const s=state();s.players[0].zones.collab=unique(dummy.number,'launch');
 s.players[1].zones.center=unique(dummy.number,'other');
 s.players[1].zones[zone]=unique(target,'target',{damage,attachments:support?[inst('hBP01-115','support')]:[]});
 s.players[1].zones.back1=unique(dummy.number,'survivor');
 s.players[1].zones.collab=unique(dummy.number,'ownLaunch');
 if(iroha)s.players[1].zones[giftZone]=unique('hBP08-029','gift');
 s.players[1].life=s.players[1].life.slice(0,life);
 s.effectQueue=[{type:kind==='arts'?'dealArtsDamage':'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:zone,sourceZone:'center',damage:amount,amount,sourceName:'Audit',artName:'Audit'}];
 s.activePlayer=own?1:0;
 return applyAction(s,s.activePlayer,{...attack,sourceZone:'collab',targetZone:'collab'},zeroPool);
}

for(const kind of ['arts','special']){
 test(`hBP07-029 ${kind}: lethal damage cannot be rescued by heal`,()=>{
  const s=settle(queueHit({kind,amount:40,damage:180}),zeroPool);
  assert.equal(s.players[1].zones.center,null);assert.equal(s.players[1].life.length,4);
  assert.equal(msgs(s).some(m=>m.includes('回復')),false);
 });
 test(`hBP07-029 ${kind}: nonlethal damage heals 50`,()=>{
  const s=queueHit({kind,amount:40,damage:100});
  // This universally attachable microphone has no defensive effect on Fauna.
  assert.equal(s.players[1].zones.center.damage,90);
 });
 for(const opts of [{support:false},{own:true},{amount:0,support:false}])test(`hBP07-029 ${kind}: nontrigger ${JSON.stringify(opts)}`,()=>{
  const s=queueHit({kind,...opts});assert.equal(msgs(s).some(m=>m.includes('受傷 Gift 回復')),false);
 });
 test(`hBP07-029 ${kind}: separate copies each heal once`,()=>{
  let s=state();s.players[0].zones.collab=unique(dummy.number,'launch');
  for(const zone of ['center','back1'])s.players[1].zones[zone]=unique('hBP07-029',zone,{damage:100,attachments:[inst('hBP01-115',zone+'support')]});
  s.effectQueue=['center','back1','center'].map(targetZone=>({type:kind==='arts'?'dealArtsDamage':'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone,sourceZone:'center',damage:20,amount:20,sourceName:'Audit',artName:'Audit'}));
  s=applyAction(s,0,{...attack,sourceZone:'collab'},zeroPool);
  assert.equal(s.players[1].zones.center.damage,90);
  assert.equal(s.players[1].zones.back1.damage,70);
 });
}

const holo=cards.find(c=>c.group==='holomem'&&c.tags.includes('#秘密結社holoX')&&c.hp>=150&&c.keyword?.type!=='gift').number;
for(const opts of [{},{kind:'special'},{zone:'back2'},{giftZone:'back2'},{target:dummy.number},{amount:0},{life:1,damage:card(holo).hp-10,amount:30}])test(`hBP08-029: pending power trigger respects timing ${JSON.stringify(opts)}`,()=>{
 const s=settle(queueHit({iroha:true,target:holo,support:false,...opts}),zeroPool);
 const expected=Object.keys(opts).length===0?1:0;
 assert.equal(s.players[1].holoPower.length,expected);
});

test('Q538 hSD09-004: lethal special damage waits for the printed Arts damage',()=>{
 const s=state('hSD09-004','hBP04-067');fund(s.players[0].zones.center,card('hSD09-004').arts[1].cost);
 s.players[1].zones.center.damage=120;s.players[1].zones.back1=unique(dummy.number,'survivor');
 const end=settle(applyAction(s,0,{...attack,artIndex:1},pool));
 const log=msgs(end),body=log.findIndex(m=>m.includes('造成 170 傷害')),ko=log.findIndex(m=>m.includes('倒下，生命'));
 assert.ok(body>=0,'printed damage must not vanish after special damage');assert.ok(ko>body);
 assert.equal(end.players[1].life.length,4);assert.equal(end.artsResolution,undefined);
});
test('Q538 hBP04-043: target selection resolves special damage before Arts and preserves no-life cause',()=>{
 const s=state('hBP04-043','hBP04-067');fund(s.players[0].zones.center,card('hBP04-043').arts[0].cost);
 s.players[1].zones.back2=unique('hBP04-067','specialTarget',{damage:120});s.players[1].zones.back1=unique(dummy.number,'survivor');
 let end=applyAction(s,0,attack,pool);
 assert.equal(end.pendingChoice?.type,'stageTarget');
 end=settle(applyAction(end,0,{type:'choose',zone:'back2'},pool));
 const log=msgs(end),special=log.findIndex(m=>m.includes('10 點特殊傷害')),body=log.findIndex(m=>m.includes('造成 20 傷害'));
 assert.ok(special>=0&&body>special);assert.equal(end.players[1].zones.back2,null);
 assert.equal(end.players[1].life.length,5);assert.equal(end.artsResolution,undefined);
});
test('native attack Q193: lethal hit resolves before hBP07-029 recovery',()=>{
 const s=state(dummy.number,'hBP07-029');s.players[1].zones.center.damage=150;
 s.players[1].zones.center.attachments=[inst('hBP01-115')];s.players[1].zones.back1=unique(dummy.number,'survivor');
 const end=settle(applyAction(s,0,attack,pool));
 assert.equal(end.players[1].zones.center,null);assert.equal(end.players[1].life.length,4);
});
test('Q538 choice survives a JSON save and rejects a second attack while resolving',()=>{
 const s=state('hBP04-043',dummy.number);fund(s.players[0].zones.center,card('hBP04-043').arts[0].cost);
 let end=applyAction(s,0,attack,pool);
 assert.equal(end.pendingChoice?.type,'stageTarget');
 assert.throws(()=>applyAction(end,0,attack,pool));
 end=JSON.parse(JSON.stringify(end));
 end=applyAction(end,0,{type:'choose',zone:'center'},pool);
 assert.equal(end.players[1].zones.center.damage,30);
 assert.equal(end.artsResolution,undefined);assert.equal(end.effectQueue.length,0);
});
for(const life of [1,5])test(`native attack: UPAO counter waits past knockout and final-life check (${life})`,()=>{
 const target=cards.find(c=>c.jpName==='天音かなた'&&c.hp>=150&&c.keyword?.type!=='gift');
 const s=state(dummy.number,target.number);s.players[1].zones.center.damage=target.hp-10;
 s.players[1].zones.center.attachments=[inst('hBP01-116')];s.players[1].zones.back1=unique(dummy.number,'survivor');s.players[1].life=s.players[1].life.slice(0,life);
 const end=settle(applyAction(s,0,attack,pool));
 assert.equal(end.players[1].zones.center,null);assert.equal(end.players[0].zones.center.damage,life===1?0:20);
 assert.equal(end.artsResolution,undefined);
});
test('hBP07-029: a newly entered different copy does not inherit the old copy usage',()=>{
 let s=queueHit({amount:40,damage:100});
 s.players[1].zones.center.stack=[inst('hBP07-029','replacement')];
 s.players[1].zones.center.damage=100;s.players[0].zones.collab.rested=false;
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',amount:40,sourceZone:'center'}];
 s=applyAction(s,0,{...attack,sourceZone:'collab',targetZone:'collab'},zeroPool);
 assert.equal(s.players[1].zones.center.damage,90);
});
for(const damage of [50,110])test(`hSD09-004 versus hBP07-029: healing waits for the complete Art (${damage})`,()=>{
 const s=state('hSD09-004','hBP07-029');fund(s.players[0].zones.center,card('hSD09-004').arts[1].cost);
 s.players[1].zones.center.damage=damage;s.players[1].zones.center.attachments=[inst('hBP01-115')];
 s.players[1].zones.back1=unique(dummy.number,'survivor');
 const end=settle(applyAction(s,0,{...attack,artIndex:1},pool));
 if(damage===110){assert.equal(end.players[1].zones.center,null);assert.equal(end.players[1].life.length,4);}
 else{assert.equal(end.players[1].zones.center.damage,130);assert.equal(end.players[1].life.length,5);}
});
