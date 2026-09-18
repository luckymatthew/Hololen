import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyAction} from '../lib/simulator/engine.mjs';
const cards=JSON.parse(readFileSync('public/cards.json','utf8')).cards;
const context=vm.createContext({structuredClone,console,Date,Math,Map,Set,crypto:globalThis.crypto});
vm.runInContext(readFileSync('../hbp09-results/native-reference/hbp09-rules.iife.js','utf8'),context,{timeout:10000});
const native=context.HololensHbp09Rules;
assert.equal(typeof native.applyAction,'function');
let id=0;const c=number=>({number,id:`parity-${++id}`});
const u=number=>({stack:[c(number)],cheer:[],attachments:[],damage:0,rested:false,enteredTurn:0,bloomedTurn:0,collabbedTurn:0,modifiers:[]});
function p(oshi,center){return{name:'Parity',oshi:c(oshi),hand:[],mainDeck:Array.from({length:30},()=>c('hBP09-064')),cheerDeck:[c('hY01-015')],archive:[],removed:[],holoPower:Array.from({length:10},()=>c('hBP09-064')),life:Array.from({length:5},()=>c('hY01-015')),zones:{center:u(center),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},modifiers:[],namedUsageTurns:{},turnsTaken:2,oshiSkillTurn:0,spOshiSkillUsed:false,turnEvents:{turn:3,supports:[],arts:[],bloomCount:0}};}
function fixture(oshi='hBP09-006',center='hBP09-070'){return{status:'playing',phase:'main',turn:3,firstPlayer:0,activePlayer:0,players:[p(oshi,center),p('hBP09-006','hBP09-064')],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};}
function stable(x){const out=JSON.parse(JSON.stringify(x));delete out.log;return out;}
const evidence=[];
function compare(label,state,actions){let web=structuredClone(state),app=structuredClone(state);for(const action of actions){web=applyAction(web,0,action,cards,()=>0.4);app=native.applyAction(app,0,action,cards,()=>0.4);assert.deepEqual(stable(app),stable(web),label);}evidence.push({label,actions:actions.length,equal:true});}
compare('Vivi normal cost and both-player draws',fixture(),[{type:'oshiSkill'}]);
compare('Vivi SP archive and hand reset',fixture(),[{type:'spOshiSkill'}]);
compare('Hajime X choice and seven-power resolution',fixture('hBP09-002','hBP09-021'),[{type:'oshiSkill'},{type:'choose',optionId:'7'}]);
const s=fixture();const support=c('hBP09-098');s.players[0].hand.push(support);compare('Suika LIMITED pre-archive condition',s,[{type:'play',cardId:support.id}]);
const tw=fixture('hBP09-005','hBP09-053');tw.phase='performance';tw.players[0].turnEvents.arts=['hBP09-053','hBP09-053'];compare('Towa reactive end-of-performance continuation',tw,[{type:'advance'},{type:'choose',optionId:'yes'}]);
console.log(JSON.stringify({referenceBundleOnly:true,androidApkBuilt:false,realDeviceTested:false,scenarios:evidence,passed:evidence.length},null,2));
