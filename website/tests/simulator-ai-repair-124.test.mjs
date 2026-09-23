import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {chooseAiAction} from '../lib/simulator/ai.mjs';
const definitions = [
 {number:'O',group:'oshi',name:'O',life:5,colors:['黃'],arts:[]},
 {number:'A',group:'holomem',name:'A',jpName:'A',stage:'Debut',hp:100,colors:['黃'],arts:[{damage:150,cost:['黃','黃']}]},
 {number:'B',group:'holomem',name:'B',jpName:'B',stage:'Debut',hp:100,colors:['黃'],arts:[{damage:20,cost:['黃']}]},
 {number:'E',group:'holomem',name:'E',jpName:'E',stage:'Debut',hp:200,colors:['黃'],arts:[{damage:170,cost:[]}]},
 {number:'C',group:'cheer',name:'C',colors:['黃']},
 {number:'F',group:'support',typeCode:'supportTool',name:'F',abilityText:'HP+20',arts:[]},
];
const inst=(number,id)=>({number,id});
const unit=(number,id)=>({stack:[inst(number,id)],cheer:[],attachments:[],damage:0,rested:false,enteredTurn:0,bloomedTurn:0,collabbedTurn:0,returnSlot:null});
const player=i=>({name:`P${i}`,oshi:inst('O',`o${i}`),ready:true,setupDone:true,turnsTaken:3,hand:[],mainDeck:Array.from({length:20},(_,n)=>inst('B',`${i}m${n}`)),cheerDeck:[inst('C',`${i}cd`)],life:Array.from({length:3},(_,n)=>inst('C',`${i}l${n}`)),holoPower:[],archive:[],zones:{center:unit(i?'A':'E',`${i}c`),collab:null,back1:unit('B',`${i}b`),back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,namedUsageTurns:{}});
function fixture(){return {status:'playing',activePlayer:0,firstPlayer:1,turn:4,phase:'performance',players:[player(0),player(1)],pendingChoice:null,effectQueue:[],log:[]};}
const expert={nodes:420,beam:4,depth:4,choiceDepth:5,samples:3};
function defensive(){const s=fixture();s.players[1].zones.center.damage=10;s.players[1].zones.center.cheer=[inst('C','old')];s.pendingChoice={type:'lifeCheerTarget',playerIndex:1,cheerCard:inst('C','new'),options:['center','back1'],winnerAfter:false,sourcePlayerIndex:0};return s;}

test('reactive Cheer survives the actual remaining enemy attack; spent attacker does not impose a blanket front ban',()=>{
 for(const spent of [false,true]){const cards=structuredClone(definitions),s=defensive(),telemetry={};s.players[0].zones.center.rested=spent;
 const action=chooseAiAction(s,1,cards,new Set(),{search:expert,telemetry});
 assert.equal(action.zone,spent?'center':'back1');
 if(!spent){const next=applyAction(applyAction(s,1,action,cards,()=>.5),0,{type:'attack',sourceZone:'center',artIndex:0,targetZone:'center'},cards,()=>.5);assert.ok(next.players[1].zones.back1.cheer.some(c=>c.id==='new'));assert.ok(telemetry.defensiveNodes>0);}
 }
});

test('defensive roots receive balanced response budgets even when displayed target order changes',()=>{
 for(const reverse of [false,true]){const s=defensive();if(reverse)s.pendingChoice.options.reverse();
 const action=chooseAiAction(s,1,structuredClone(definitions),new Set(),{search:{...expert,nodes:12,samples:1}});assert.equal(action.zone,'back1');}
});

test('mandatory unique card selection validates once and preserves subsequent placement; optional skip is not forced',()=>{
 const cards=structuredClone(definitions),s=fixture();s.activePlayer=1;s.phase='main';s.pendingChoice={type:'cardSelection',playerIndex:1,cards:[s.players[1].mainDeck[0]],selectableIds:[s.players[1].mainDeck[0].id],min:1,max:1,effect:'deckCardsToStage',source:'deck',optional:false,meta:{}};
 const telemetry={};const action=chooseAiAction(s,1,cards,new Set(),{search:expert,telemetry});
 assert.equal(telemetry.nodes,1);assert.equal(telemetry.forced,true);assert.equal(telemetry.actions[0].score,null);
 const next=applyAction(s,1,action,cards,()=>.5);assert.ok(next.pendingChoice);assert.notEqual(next.pendingChoice.type,'cardSelection');
 s.pendingChoice.optional=true;const optional={};chooseAiAction(s,1,cards,new Set(),{search:expert,telemetry:optional});assert.equal(optional.forced,false);assert.ok(optional.actions.some(r=>r.action.skip));
 const excluded={};chooseAiAction(s,1,cards,new Set([JSON.stringify(action)]),{search:expert,telemetry:excluded});assert.equal(excluded.forced,false);
});

test('defensive decision is unchanged by concealed enemy card identities or own hidden order',()=>{
 const first=defensive(),second=structuredClone(first);second.players[0].hand=[inst('UNKNOWN','hidden')];first.players[0].hand=[inst('E','secret')];second.players[1].mainDeck.reverse();
 const options={search:expert,seed:20260921};assert.deepEqual(chooseAiAction(first,1,structuredClone(definitions),new Set(),options),chooseAiAction(second,1,structuredClone(definitions),new Set(),options));
});
