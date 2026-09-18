import test from 'node:test';
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


export {fixture,cards,map,N,instance,unit,act,answer,settle,support,attack,runCollab,conserve};
