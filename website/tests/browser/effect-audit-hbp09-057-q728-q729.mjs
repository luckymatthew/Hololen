import {applyAction} from '../../lib/simulator/engine.mjs';

const response=await fetch('/cards.json');
if(!response.ok)throw new Error(`Could not load current cards.json (${response.status})`);
const cards=(await response.json()).cards;
const map=new Map(cards.map(card=>[card.number,card]));
const status=document.querySelector('#status');
const output=document.querySelector('#result');
const support=cards.find(card=>card.group==='support');
let serial=0;
const instance=number=>({id:`browser-q728-q729-${++serial}`,number});
const unit=(number,cheer=[])=>({stack:[instance(number)],cheer,attachments:[],damage:0,rested:false,enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player=(name)=>({name,oshi:instance('hBP09-006'),ready:true,setupDone:true,turnsTaken:3,mainDeck:[],cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],removed:[],zones:{center:null,collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,limitedUsesCount:0,limitedAllowanceTurn:0,limitedAllowance:1,oshiSkillTurn:0,spOshiSkillUsed:false,namedUsageTurns:{},modifiers:[],turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}});
function battle(){
  const own=player('You'),opponent=player('Opponent');
  own.zones.center=unit('hBP01-023',['hY01-001','hY01-001','hY01-001'].map(instance));
  own.zones.collab=unit('hBP09-057',['hY04-001','hY01-001','hY01-001'].map(instance));
  opponent.zones.center=unit('hBP02-064');
  opponent.zones.back1=unit('hBP02-064');
  return {status:'playing',phase:'performance',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
}
const act=(state,action,random=()=>0.25)=>{
  try{return applyAction(state,0,action,cards,random);}
  catch(error){
    throw new Error(`${action.sourceZone} Art ${action.artIndex} -> ${action.targetZone}: ${error instanceof Error?error.message:String(error)}`);
  }
};
const choose=(state,action)=>applyAction(state,state.pendingChoice.playerIndex,{type:'choose',...action},cards,()=>0.25);

try{
  for(const number of ['hBP01-023','hBP09-057','hBP02-064','hY01-001','hY04-001'])if(!map.has(number))throw new Error(`Current catalog is missing ${number}`);
  if(!support)throw new Error('Current catalog has no Support for Q728');

  let first=battle();
  const firstDeck=first.players[0].mainDeck.map(card=>card.id);
  first=act(first,{type:'attack',sourceZone:'collab',artIndex:0,targetZone:'center'});
  if(first.pendingChoice||first.players[0].turnEvents.arts.length!==1||first.players[1].zones.center.damage!==70||JSON.stringify(first.players[0].mainDeck.map(card=>card.id))!==JSON.stringify(firstDeck))throw new Error('Towa incorrectly searched on its first Arts use.');

  let search=battle();
  const supportCard=instance(support.number),rest=[instance('hBP09-064'),instance('hBP02-064'),instance('hBP09-064')];
  search.players[0].mainDeck=[supportCard,...rest];
  search=act(search,{type:'attack',sourceZone:'center',artIndex:0,targetZone:'center'},()=>0.2);
  search=act(search,{type:'attack',sourceZone:'collab',artIndex:0,targetZone:'center'});
  if(search.pendingChoice?.type!=='cardSelection'||search.pendingChoice.max!==1||!search.pendingChoice.selectableIds.includes(supportCard.id))throw new Error('Q728 did not offer the revealed Support after another Holomem used the first Arts.');
  search=choose(search,{cardIds:[supportCard.id]});
  const ordered=[rest[2],rest[0],rest[1]];
  search=choose(search,{cardIds:ordered.map(card=>card.id)});
  if(!search.players[0].hand.some(card=>card.id===supportCard.id)||JSON.stringify(search.players[0].mainDeck.map(card=>card.id))!==JSON.stringify(ordered.map(card=>card.id)))throw new Error('Q728 failed to add the chosen Support or bottom the other three in order.');

  let empty=battle();
  const looked=['hBP09-064','hBP02-064','hBP09-064','hBP02-064'].map(instance);
  empty.players[0].mainDeck=looked;
  empty=act(empty,{type:'attack',sourceZone:'center',artIndex:0,targetZone:'center'},()=>0.2);
  empty=act(empty,{type:'attack',sourceZone:'collab',artIndex:0,targetZone:'center'});
  const emptyOrder=[looked[3],looked[1],looked[0],looked[2]];
  if(empty.pendingChoice?.min!==4)throw new Error('Q728 empty-Support boundary did not require ordering the four remaining cards.');
  empty=choose(empty,{cardIds:emptyOrder.map(card=>card.id)});
  if(JSON.stringify(empty.players[0].mainDeck.map(card=>card.id))!==JSON.stringify(emptyOrder.map(card=>card.id)))throw new Error('Q728 empty-Support boundary did not bottom all four cards in the selected order.');

  let third=battle();
  // Start from a checkpoint after two committed Sora Arts. The website unit
  // regression exercises those two real actions end-to-end; this browser harness
  // isolates Towa's third-Arts resolution in the current browser engine.
  third.players[0].zones.center.rested=true;
  third.players[0].turnEvents.arts=['hBP01-023','hBP01-023'];
  third.players[1].zones.center.damage=0;
  third.players[1].zones.collab=unit('hBP02-064');
  third.players[1].zones.back1=unit('hBP02-064');
  if(third.players[0].turnEvents.arts.length!==2||third.players[1].zones.center.damage!==0)throw new Error('The two committed Arts did not leave the expected precondition for Q729.');
  third=act(third,{type:'attack',sourceZone:'collab',artIndex:1,targetZone:'center'});
  if(third.pendingChoice?.type!=='stageTarget'||!third.pendingChoice.options.includes('back1'))throw new Error('Q729 did not offer a third-Arts special-damage target after two other-Holomem Arts.');
  third=choose(third,{zone:'back1'});
  if(third.players[1].zones.back1.damage!==50||third.players[1].zones.collab.damage!==0||third.players[1].zones.center.damage!==100)throw new Error('Q729 third-Arts special damage did not settle separately from the Center Arts hit.');

  let beforeThird=battle();
  beforeThird=act(beforeThird,{type:'attack',sourceZone:'center',artIndex:0,targetZone:'center'},()=>0.2);
  beforeThird=act(beforeThird,{type:'attack',sourceZone:'collab',artIndex:1,targetZone:'center'});
  if(beforeThird.pendingChoice||beforeThird.players[1].zones.back1.damage!==0)throw new Error('Q729 special damage triggered before the third Arts use.');

  const results=[
    {case:'Towa first Arts use',arts:1,search:false},
    {case:'Q728 another Holomem makes Towa second; chosen Support plus ordered leftovers',arts:2,handHasSupport:true,bottomOrder:ordered.map(card=>card.number)},
    {case:'Q728 no Support in top four',orderedAllFour:true,bottomOrder:emptyOrder.map(card=>card.number)},
    {case:'Q729 after two committed Arts, Towa is third',arts:3,chosenTarget:'back1',specialDamage:50,normalArtsTarget:'center',normalArtsDamage:100},
    {case:'Q729 Towa second Arts use',arts:2,specialDamage:0},
  ];
  status.textContent='PASS: current browser runtime follows Q728/Q729 Arts counts across Holomem, Support-search ordering, and third-Arts special damage.';
  output.textContent=JSON.stringify({pass:true,results},null,2);
}catch(error){
  status.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;
  output.textContent=JSON.stringify({pass:false,error:String(error)},null,2);
}
