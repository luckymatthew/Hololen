import {applyAction,isActionCandidateLegal} from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const map = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({id:`browser-q732-${++serial}`,number});
const unit = (number,damage=0) => ({stack:[instance(number)],cheer:[],attachments:[],damage,rested:false,enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player = (name,oshi) => ({name,oshi:instance(oshi),ready:true,setupDone:true,turnsTaken:3,mainDeck:Array.from({length:12},()=>instance('hBP01-106')),cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],removed:[],zones:{center:null,collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,limitedUsesCount:0,limitedAllowanceTurn:0,limitedAllowance:1,oshiSkillTurn:0,spOshiSkillUsed:false,namedUsageTurns:{},modifiers:[],turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}});
const state = {status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:1,players:[player('Matsuri','hBP06-008'),player('Opponent','hBP06-008')],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
const own = state.players[0];
own.zones.center = unit('hBP06-077',100);
own.zones.back1 = unit('hBP09-087');
own.zones.back2 = unit('hBP06-077',100);
own.hand = [instance('hBP06-086'),instance('hBP06-086'),instance('hBP06-086')];
own.holoPower = [instance('hBP01-106')];

const act = action => applyAction(state,0,action,cards,()=>0.25);
function useLimited(current,id,zone) {
  current = applyAction(current,0,{type:'play',cardId:id},cards,()=>0.25);
  if(current.pendingChoice?.type!=='stageTarget'||!current.pendingChoice.options.includes(zone))throw new Error('A real LIMITED Support did not resolve to its legal heal target.');
  current = applyAction(current,0,{type:'choose',zone},cards,()=>0.25);
  if(current.pendingChoice)throw new Error('The Support action left a pending choice.');
  return current;
}

try {
  for(const number of ['hBP06-008','hBP06-077','hBP06-086','hBP09-087'])if(!map.has(number))throw new Error(`Current catalog is missing ${number}`);
  let current = act({type:'spOshiSkill'});
  if(current.players[0].holoPower.length!==0||current.players[0].limitedAllowance!==2)throw new Error('Matsuri SP cost or two-use allowance was not applied.');
  const [first,second,third]=current.players[0].hand;
  current = useLimited(current,first.id,'center');
  current = useLimited(current,second.id,'back2');
  if(current.players[0].limitedUsesCount!==2)throw new Error('The engine did not count both completed LIMITED Supports.');
  current = applyAction(current,0,{type:'collab',zone:'back1'},cards,()=>0.25);
  if(current.players[0].zones.collab.stack.at(-1).number!=='hBP09-087'||current.pendingChoice?.type!=='optionChoice')throw new Error('The active 2nd Matsuri did not Collab and prompt its ability.');
  current = applyAction(current,0,{type:'choose',optionId:'yes'},cards,()=>0.25);
  if(current.pendingChoice||current.players[0].limitedAllowance!==2||current.players[0].limitedUsesCount!==2)throw new Error('The Collab effect stacked the allowance or changed the used count.');
  if(isActionCandidateLegal(current,0,{type:'play',cardId:third.id},cards))throw new Error('A third LIMITED Support remains a legal action after Q732.');
  const before=structuredClone(current);
  let rejected=false;
  try { applyAction(current,0,{type:'play',cardId:third.id},cards,()=>0.25); } catch(error) { rejected=/LIMITED/u.test(String(error)); }
  if(!rejected||JSON.stringify(current)!==JSON.stringify(before))throw new Error('Third LIMITED Support was not rejected without state mutation.');
  status.textContent='PASS: Q732 two-use ceiling holds after SP, two real LIMITED Supports, and the 2nd Matsuri Collab Effect.';
  output.textContent=JSON.stringify({pass:true,turn:current.turn,collabCard:current.players[0].zones.collab.stack.at(-1).number,usedLimited:current.players[0].limitedUsesCount,allowance:current.players[0].limitedAllowance,thirdUseLegal:isActionCandidateLegal(current,0,{type:'play',cardId:third.id},cards),pendingChoice:current.pendingChoice,archive:current.players[0].archive.map(card=>card.number)},null,2);
} catch(error) {
  status.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;
  output.textContent=JSON.stringify({pass:false,error:String(error)},null,2);
}
