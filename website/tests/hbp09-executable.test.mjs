import test from 'node:test';
import {registerExtraCases} from './hbp09-extra-cases.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,publicRoomState} from '../lib/simulator/engine.mjs';
import {createHbp09} from '../lib/simulator/hbp09/hooks.mjs';
import {PROGRAMS} from '../lib/simulator/hbp09/programs.mjs';
import {oshiSkillPowerCost,isActivatableOshiSkill,isReactiveOshiSkill} from '../lib/simulator/oshi-skill-catalog.mjs';
const source=JSON.parse(readFileSync(new URL('../public/cards.json',import.meta.url),'utf8')).cards;
const dummy={number:'TEST-TARGET',name:'Test target',jpName:'Test target',group:'holomem',stage:'2nd',type:'Holomen',hp:9999,colors:[],tags:[],baton:0,arts:[{name:'Test hit',damage:0,cost:[],effect:''}]};
const cards=[...source,dummy];const map=new Map(cards.map(c=>[c.number,c]));
const N=n=>`hBP09-${String(n).padStart(3,'0')}`;
let serial=0;
const instance=number=>({id:`hbp09-test-${++serial}`,number});
const cheerNumbers=['hY01-015','hY02-013','hY03-017','hY04-014','hY05-012','hY06-012'];
const unit=(number,energies=0)=>({stack:[instance(number)],cheer:Array.from({length:energies},(_,i)=>instance(cheerNumbers[i%6])),attachments:[],damage:0,rested:false,enteredTurn:0,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player=(oshi,center)=>({name:'Player',oshi:instance(N(oshi)),zones:{center:unit(N(center)),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},hand:[],mainDeck:Array.from({length:40},()=>instance(N(51))),cheerDeck:Array.from({length:10},(_,i)=>instance(cheerNumbers[i%6])),archive:[],holoPower:Array.from({length:10},()=>instance(N(51))),life:Array.from({length:5},()=>instance(cheerNumbers[0])),turnsTaken:2,modifiers:[],namedUsageTurns:{},turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0},oshiSkillTurn:0,spOshiSkillUsed:false,collabTurn:0,batonTurn:0});
function fixture(oshi=6,center=64){const s={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:0,players:[player(oshi,center),player(6,64)],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};s.players[1].zones.center=unit('TEST-TARGET');s.players[1].zones.back1=unit(N(64));return s;}
const act=(s,a,i=0,custom=cards,random=()=>0.4)=>applyAction(s,i,a,custom,random);
function answer(s,choice={},custom=cards){const p=s.pendingChoice;assert.ok(p,'Expected a pending choice');return act(s,{type:'choose',...choice},p.playerIndex,custom);}
function settle(s,custom=cards,limit=80){for(let k=0;s.pendingChoice&&k<limit;k++){const p=s.pendingChoice;let a;
 if(p.type==='cardSelection')a={cardIds:p.selectableIds.slice(0,p.min||0)};
 else if(p.type==='optionChoice')a={optionId:p.modeOptions[0].id,option:p.modeOptions[0].id,mode:p.modeOptions[0].id};
 else if(p.optional)a={skip:true};else a={zone:p.options?.[0],targetZone:p.options?.[0]};
 s=answer(s,a,custom);
 }assert.equal(s.pendingChoice,null,'Choice sequence did not finish');return s;}
function support(s,n){const c=instance(N(n));s.players[0].hand.push(c);return act(s,{type:'play',cardId:c.id});}
function attack(s,index=0,targetZone='center',custom=cards,i=0){s.phase='performance';return act(s,{type:'attack',sourceZone:'center',targetZone,artIndex:index},i,custom);}
function runCollab(n,configure=()=>{}){const s=fixture();s.players[0].zones.back1=unit(N(n));configure(s);return act(s,{type:'collab',zone:'back1'});}
function allInstances(s){return s.players.flatMap(p=>[p.oshi,...p.mainDeck,...p.cheerDeck,...p.hand,...p.archive,...p.holoPower,...p.life,...Object.values(p.zones).filter(Boolean).flatMap(u=>[...u.stack,...u.cheer,...u.attachments])]);}
function conserve(before,after){assert.deepEqual(allInstances(after).map(c=>c.id).sort(),allInstances(before).map(c=>c.id).sort());}

test('hBP09 oshi executable costs and reactive windows are explicitly registered',()=>{
 assert.equal(oshiSkillPowerCost(N(2)),'X');assert.equal(oshiSkillPowerCost(N(6),'sp'),3);
 assert.equal(isActivatableOshiSkill(N(6),'sp'),true);assert.equal(isReactiveOshiSkill(N(5)),true);assert.equal(isActivatableOshiSkill(N(5)),false);
});
test('Vivi normal draws 3/2 and pays exactly two power, once per turn',()=>{
 const s=fixture();const original=structuredClone(s);const out=act(s,{type:'oshiSkill'});
 assert.equal(out.players[0].hand.length,3);assert.equal(out.players[1].hand.length,2);assert.equal(out.players[0].holoPower.length,8);
 assert.equal(out.players[0].archive.length,2);assert.throws(()=>act(out,{type:'oshiSkill'}));assert.deepEqual(s,original);conserve(s,out);
});
test('Vivi SP preserves archive cheer and recycles Holomen/support for both players',()=>{
 const s=fixture(6,70);for(const p of s.players){p.archive=[instance(N(51)),instance(N(90)),instance(cheerNumbers[0])];p.hand=[instance(N(60))];}
 const out=act(s,{type:'spOshiSkill'});assert.equal(out.players[0].hand.length,7);assert.equal(out.players[1].hand.length,7);
 assert.equal(out.players[0].holoPower.length,7);assert.equal(out.players[0].archive.length,1);assert.equal(out.players[0].archive[0].number,cheerNumbers[0]);assert.ok(out.players[0].spOshiSkillUsed);conserve(s,out);
});
test('illegal Vivi SP never mutates the original state or spends power',()=>{const s=fixture(6,64),copy=structuredClone(s);assert.throws(()=>act(s,{type:'spOshiSkill'}));assert.deepEqual(s,copy);});
test('Hajime X seven payment gives center +170 and other Hajime +100',()=>{
 const s=fixture(2,21);s.players[0].zones.back1=unit(N(17));let out=act(s,{type:'oshiSkill'});assert.equal(out.players[0].holoPower.length,10);
 out=answer(out,{optionId:'7'});assert.equal(out.players[0].holoPower.length,3);
 assert.equal(out.players[0].zones.center.modifiers.reduce((n,m)=>n+m.amount,0),170);assert.equal(out.players[0].zones.back1.modifiers[0].amount,100);conserve(s,out);
});
test('Hajime X rejects out-of-range payment and duplicate activation',()=>{
 let s=act(fixture(2,21),{type:'oshiSkill'});const before=structuredClone(s);assert.throws(()=>answer(s,{optionId:'999'}));assert.deepEqual(s,before);
 s=answer(s,{optionId:'0'});assert.throws(()=>act(s,{type:'oshiSkill'}));
});
test('Subaru search copies selected enemy Bloom level and deploys without losing cards',()=>{
 const s=fixture(1,8);s.players[0].mainDeck=[instance(N(10)),instance(N(14)),...s.players[0].mainDeck];s.players[1].zones.back1=unit(N(17));
 let out=act(s,{type:'oshiSkill'});out=answer(out,{zone:'back1'});assert.equal(out.pendingChoice.type,'cardSelection');
 assert.ok(out.pendingChoice.cards.every(c=>map.get(c.number).stage==='1st'));out=answer(out,{cardIds:[out.pendingChoice.selectableIds[0]]});
 out=answer(out,{zone:'back1'});assert.equal(out.players[0].zones.back1.stack[0].number,N(10));conserve(s,out);
});
test('Lamy search allows selecting two matching cards and keeps hidden deck private',()=>{
 const s=fixture(7,77);s.players[0].mainDeck.unshift(instance(N(95)),instance(N(110)));
 let out=act(s,{type:'oshiSkill'});assert.equal(out.pendingChoice.max,2);
 const opponent=publicRoomState(out,1);assert.deepEqual(opponent.pendingChoice,{type:'opponent',playerIndex:0});assert.equal(opponent.players[0].mainDeck,undefined);for(const hidden of out.pendingChoice.cards)assert.ok(!JSON.stringify(opponent).includes(hidden.id));
 out=answer(out,{cardIds:out.pendingChoice.selectableIds.slice(0,2)});assert.equal(out.players[0].hand.length,2);conserve(s,out);
});
test('collab draw-two-bottom-two respects player ordering',()=>{
 let out=runCollab(10);assert.equal(out.players[0].hand.length,2);const ids=out.pendingChoice.cards.map(c=>c.id).reverse();out=answer(out,{cardIds:ids});assert.deepEqual(out.players[0].mainDeck.slice(-2).map(c=>c.id),ids);
});
test('duplicate card IDs in hBP09 choice are rejected without state mutation',()=>{
 const s=runCollab(10),copy=structuredClone(s);const id=s.pendingChoice.selectableIds[0];assert.throws(()=>answer(s,{cardIds:[id,id]}));assert.deepEqual(s,copy);
});
test('another player cannot resolve someone else\'s effect choice',()=>{const s=runCollab(10);assert.throws(()=>act(s,{type:'choose',cardIds:[]},1));});
test('conditional first-turn collab does not run on later turns',()=>{const out=runCollab(39);assert.equal(out.pendingChoice,null);assert.equal(out.players[0].hand.length,0);});
test('second-player first turn can search exactly the eligible tools',()=>{
 let out=runCollab(39,s=>{s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].mainDeck.unshift(instance(N(51)),instance(N(106)),instance(N(107)));});
 assert.equal(out.pendingChoice.max,2);assert.ok(out.pendingChoice.cards.every(c=>map.get(c.number).typeCode==='supportTool'));out=answer(out,{cardIds:out.pendingChoice.selectableIds});assert.equal(out.players[0].hand.length,2);
});
test('support activation restrictions are enforced before consumption',()=>{
 for(const n of [91,92,94,95,99,101,102,103,105]){const s=fixture(4,38);const c=instance(N(n));s.players[0].hand.push(c);const before=structuredClone(s);assert.throws(()=>act(s,{type:'play',cardId:c.id}),String(n));assert.deepEqual(s,before);}
});
test('support 090 pays topmost power without looking before revealing matching Collab holomem',()=>{
 const s=fixture(6,64);s.players[0].mainDeck.unshift(instance(N(65)));const paid=s.players[0].holoPower.at(-1).id;let out=support(s,90);
 assert.equal(out.players[0].holoPower.length,9);assert.ok(out.players[0].archive.some(c=>c.id===paid));assert.equal(out.pendingChoice.cards[0].number,N(65));
 out=answer(out,{cardIds:[out.pendingChoice.cards[0].id]});assert.ok(out.players[0].hand.some(c=>c.number===N(65)));conserve(s,out);
});
test('Vivi rain draws both players and applies conditional +30',()=>{const s=fixture(6,70);s.players[1].hand=Array.from({length:5},()=>instance(N(64)));const out=support(s,92);assert.equal(out.players[1].hand.length,7);assert.equal(out.players[0].hand.length,2);assert.equal(out.players[0].zones.center.modifiers[0].amount,30);});
test('Suika bubble does not count the just-played LIMITED card itself',()=>{const out=support(fixture(),98);assert.equal(out.players[0].hand.length,4);assert.equal(out.pendingChoice,null);});
test('Suika bubble with previous LIMITED requires ordered four-card return',()=>{const s=fixture();s.players[0].archive=[instance(N(92))];let out=support(s,98);assert.equal(out.pendingChoice.min,4);const ids=out.pendingChoice.cards.map(c=>c.id).reverse();out=answer(out,{cardIds:ids});assert.deepEqual(out.players[0].mainDeck.slice(-4).map(c=>c.id),ids);});
test('Lamy toast threshold excludes current support and is once per turn',()=>{const s=fixture(7,77);s.players[0].archive=[instance(N(95))];let out=support(s,95);out=answer(out,{zone:'center'});assert.equal(out.players[1].zones.center.damage,10);assert.throws(()=>support(out,95));});
test('Lamy toast with two previous copies deals 40',()=>{const s=fixture(7,77);s.players[0].archive=[instance(N(95)),instance(N(95))];let out=support(s,95);out=answer(out,{zone:'center'});assert.equal(out.players[1].zones.center.damage,40);});
test('Hajime dance takes actual power cards to hand, not fabricated copies',()=>{const s=fixture(2,15);let out=support(s,102);assert.equal(out.players[0].holoPower.length,12);const chosen=out.pendingChoice.cards.slice(-2).map(c=>c.id);out=answer(out,{cardIds:chosen});assert.deepEqual(out.players[0].hand.map(c=>c.id).sort(),chosen.sort());assert.equal(out.players[0].holoPower.length,10);conserve(s,out);});
test('highest remaining HP support buffs every tied highest member',()=>{const s=fixture();s.players[0].zones.back1=unit(N(64));const out=support(s,104);assert.equal(out.players[0].zones.center.modifiers[0].amount,30);assert.equal(out.players[0].zones.back1.modifiers[0].amount,30);});
test('Kaela can hold second Arms tool, but not a third',()=>{
 const s=fixture(4,44);s.players[0].zones.center.attachments=[instance(N(106))];let out=support(s,107);out=answer(out,{zone:'center'});out=settle(out);assert.equal(out.players[0].zones.center.attachments.length,2);assert.equal(out.players[0].hand.length,2);assert.throws(()=>support(out,106));
});
test('Pemaloe cannot attach to a non-Kaela host',()=>{assert.throws(()=>support(fixture(),111));});
test('Subaru stage cost removes one white cheer requirement',()=>{const s=fixture(1,8);const out=attack(s);assert.equal(out.players[1].zones.center.damage,30);});
test('Kaela Arms gift removes red cost and Arts passive bonus applies',()=>{const s=fixture(4,41);s.players[0].zones.center.attachments=[instance(N(107))];const out=attack(s);assert.equal(out.players[1].zones.center.damage,30);});
test('Vivi hand thresholds choose +70 or +100, never stack both',()=>{
 for(const [size,damage]of [[7,190],[10,220]]){const s=fixture(6,70);s.players[0].zones.center.cheer=[instance(cheerNumbers[4])];s.players[1].hand=Array.from({length:size},()=>instance(N(64)));const out=attack(s);assert.equal(out.players[1].zones.center.damage,damage);}
});
test('Lamy stage +20 versus +50 after five sake supports',()=>{for(const [n,expected]of [[0,150],[5,180]]){const s=fixture(7,82);s.players[0].zones.center.cheer=Array.from({length:3},()=>instance(cheerNumbers[5]));s.players[0].archive=Array.from({length:n},()=>instance(N(110)));const out=attack(s);assert.equal(out.players[1].zones.center.damage,expected);}});
test('Lamy gift adds the full extra cost while archive threshold unmet',()=>{const s=fixture(7,83);s.players[0].zones.center.cheer=[instance(cheerNumbers[5])];assert.throws(()=>attack(s));});
test('Nerissa Arts target-stage bonus applies to 2nd target',()=>{const s=fixture(6,74);s.players[0].zones.center.cheer=[instance(cheerNumbers[0]),instance(cheerNumbers[0])];const out=attack(s);assert.equal(out.players[1].zones.center.damage,100);});
test('Towa gets only one extra center attack, and must choose different Arts name',()=>{
 const s=fixture(5,53);s.players[0].zones.center.cheer=Array.from({length:3},()=>instance(cheerNumbers[3]));let out=attack(s,0);assert.equal(out.players[0].zones.center.rested,false);
 assert.throws(()=>attack(out,0));out=attack(out,1);assert.equal(out.players[0].zones.center.rested,true);assert.equal(out.players[1].zones.center.damage,110);assert.throws(()=>attack(out,0));
});
test('Towa draw skill is unavailable in main and offered at performance end',()=>{
 let s=fixture(5,53);assert.throws(()=>act(s,{type:'oshiSkill'}));s.phase='performance';s.players[0].turnEvents.arts=[N(53),N(53)];let out=act(s,{type:'advance'});assert.equal(out.pendingChoice.effect,'hbp09');out=answer(out,{optionId:'yes'});assert.equal(out.players[0].hand.length,2);assert.equal(out.players[0].holoPower.length,8);assert.equal(out.activePlayer,1);
});
test('Hajime baton stage adds one Holo Power, and movement remains normal',()=>{const s=fixture(2,15);s.players[0].zones.center.cheer=[instance(cheerNumbers[0])];s.players[0].zones.back1=unit(N(17));const out=act(s,{type:'baton',zone:'back1'});assert.equal(out.players[0].holoPower.length,11);assert.equal(out.players[0].zones.center.stack[0].number,N(17));});
test('Subaru damage Gift triggers after real Arts damage',()=>{const s=fixture(1,8);s.activePlayer=1;s.turn=4;s.phase='performance';const attacker={...dummy,number:'TEST-ATTACKER',arts:[{name:'Hit',damage:40,cost:[],effect:''}]};const custom=[...cards,attacker];s.players[1].zones.center=unit(attacker.number);const out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0},1,custom);assert.equal(out.players[0].zones.center.damage,40);assert.equal(out.players[1].zones.center.damage,30);});
test('Hajime passive reduces actual received Arts damage by 30',()=>{const s=fixture(2,17);s.activePlayer=1;s.turn=4;s.phase='performance';const attacker={...dummy,number:'TEST-ATTACKER',arts:[{name:'Hit',damage:60,cost:[],effect:''}]};s.players[1].zones.center=unit(attacker.number);s.players[1].zones.center=unit(attacker.number);const out=act(s,{type:'attack',sourceZone:'center',targetZone:'center',artIndex:0},1,[...cards,attacker]);assert.equal(out.players[0].zones.center.damage,30);});
test('all effect continuations serialize and resume without closures',()=>{const s=runCollab(10);const encoded=JSON.stringify(s);const restored=JSON.parse(encoded);const out=answer(restored,{cardIds:restored.pendingChoice.selectableIds});assert.equal(out.pendingChoice,null);assert.equal(out.players[0].hand.length,0);});
test('unknown program instructions fail closed rather than silently claiming success',()=>{const runtime=createHbp09({});const s=fixture();assert.throws(()=>runtime.run(s,runtime.context(s,0,N(1)),[{op:'UNIMPLEMENTED_TEST'}],new Map(),()=>0.5),/Unimplemented/);});
test('program data are plain JSON and no empty fake resolvers are registered',()=>{const restored=JSON.parse(JSON.stringify(PROGRAMS));assert.ok(Object.keys(restored).length>90);for(const [key,steps]of Object.entries(restored)){assert.ok(Array.isArray(steps)&&steps.length>0,key);}});
registerExtraCases({test,assert,cards,map,N,instance,unit,fixture,act,answer,settle,support,attack,runCollab,conserve,cheerNumbers});
