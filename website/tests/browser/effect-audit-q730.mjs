import {applyAction,publicRoomState} from '../../lib/simulator/engine.mjs';

const response=await fetch('/cards.json');
if(!response.ok)throw new Error(`Could not load current cards.json (${response.status})`);
const cards=(await response.json()).cards;
const map=new Map(cards.map(card=>[card.number,card]));
const status=document.querySelector('#status');
const output=document.querySelector('#result');
let serial=0;
const instance=number=>({id:`browser-q730-${++serial}`,number});
const unit=number=>({stack:[instance(number)],cheer:[],attachments:[],damage:0,rested:false,enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player=(name,oshi,center)=>({name,oshi:instance(oshi),zones:{center:unit(center),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},hand:[],mainDeck:[],cheerDeck:[],archive:[],holoPower:[],life:[],turnsTaken:2,namedUsageTurns:{},oshiSkillTurn:0,spOshiSkillUsed:false,collabTurn:0,batonTurn:0,turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}});
const state={status:'playing',phase:'main',turn:3,activePlayer:0,firstPlayer:0,players:[player('Kronii','hBP07-001','hBP07-050'),player('Opponent','hBP07-001','hBP01-092')],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
const first=instance('hBP09-063');
const second=instance('hBP09-063');
const third=instance('hBP09-063');
state.players[0].hand=[first,second,third];
state.players[0].zones.back1=unit('hBP07-051');
state.players[0].zones.back2=unit('hBP01-092');
const top=instance('hBP09-005');
const middle=instance('hBP09-006');
const bottom=instance('hBP09-007');
state.players[0].mainDeck=[top,middle,bottom];

function bloom(current,card,zone){
  let next=applyAction(current,0,{type:'play',cardId:card.id},cards,()=>0.25);
  if(next.pendingChoice?.type!=='bloom'||!next.pendingChoice.options.includes(zone))throw new Error(`Missing legal Bloom selection for ${zone}`);
  next=applyAction(next,0,{type:'choose',zone},cards,()=>0.25);
  return next;
}

try{
  for(const number of ['hBP09-063','hBP07-050','hBP07-051','hBP01-092','hBP09-005','hBP09-006','hBP09-007'])if(!map.has(number))throw new Error(`Current catalog is missing ${number}`);
  let current=bloom(state,first,'center');
  if(current.players[0].hand.at(-1)?.id!==bottom.id||current.players[0].mainDeck.at(-1)?.id!==middle.id||current.players[0].mainDeck[0]?.id!==top.id)throw new Error('The first draw did not take the actual deck-bottom card.');
  if(JSON.stringify(current.log).includes(bottom.id))throw new Error('The deck-bottom card identity was logged as revealed.');
  const opponentView=publicRoomState(current,1,cards);
  if(JSON.stringify(opponentView).includes(bottom.id)||opponentView.players[0].handCount!==3)throw new Error('The opponent view exposed the drawn card or an incorrect hand count.');

  current=bloom(current,second,'back1');
  if(current.players[0].mainDeck.at(-1)?.id!==middle.id)throw new Error('The named once-per-turn cap did not stop a second copy.');
  current.turn=4;
  current.players[0].turnsTaken=3;
  current.players[0].turnEvents={turn:4,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0};
  current=bloom(current,third,'back2');
  if(current.players[0].hand.at(-1)?.id!==middle.id||current.players[0].namedUsageTurns['hbp09:Student-of-Time']!==4)throw new Error('The once-per-turn cap did not reset on the following turn.');
  status.textContent='PASS: bottom card drawn first face down; public hand stayed redacted; same-name limit spanned copies and reset next turn.';
  output.textContent=JSON.stringify({pass:true,handIds:current.players[0].hand.map(card=>card.id),mainDeckIds:current.players[0].mainDeck.map(card=>card.id),usageTurn:current.players[0].namedUsageTurns['hbp09:Student-of-Time'],opponentHandCount:opponentView.players[0].handCount,pendingChoice:current.pendingChoice},null,2);
}catch(error){
  status.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;
  output.textContent=JSON.stringify({pass:false,error:String(error),state},null,2);
}
