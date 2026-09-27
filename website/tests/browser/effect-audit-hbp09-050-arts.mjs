import {applyAction} from '../../lib/simulator/engine.mjs';

const response=await fetch('/cards.json');
if(!response.ok)throw new Error(`Could not load current cards.json (${response.status})`);
const cards=(await response.json()).cards;
const map=new Map(cards.map(card=>[card.number,card]));
const status=document.querySelector('#status');
const output=document.querySelector('#result');
let serial=0;
const instance=number=>({id:`browser-hbp09-050-arts-${++serial}`,number});
const unit=(number,cheer=[])=>({stack:[instance(number)],cheer,attachments:[],damage:0,rested:false,enteredTurn:1,bloomedTurn:0,collabbedTurn:0,returnSlot:null,modifiers:[],skipUnrestTurn:0});
const player=(name)=>({name,oshi:instance('hBP09-001'),ready:true,setupDone:true,turnsTaken:2,mainDeck:[],cheerDeck:[],hand:[],life:[],holoPower:[],archive:[],removed:[],zones:{center:null,collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,limitedUsesCount:0,limitedAllowanceTurn:0,limitedAllowance:1,oshiSkillTurn:0,spOshiSkillUsed:false,namedUsageTurns:{},modifiers:[],turnEvents:{turn:3,supports:[],arts:[],bloomCount:0,cheerArchived:0,deckArchived:0,stageReturned:0}});

function useArt({subaruZones=[],opponentSubaru=false,target='hBP04-072',sourceZone='center',coveredSubaru=false}={}){
  const own=player('You'),opponent=player('Opponent');
  own.zones.center=unit(sourceZone==='center'?'hBP09-050':'hBP04-067');
  own.zones[sourceZone]=unit('hBP09-050',['hY01-015','hY01-015','hY01-015'].map(instance));
  for(const zone of subaruZones)own.zones[zone]=unit('hBP04-067');
  if(coveredSubaru)own.zones.back3={...unit('hBP09-064'),stack:[instance('hBP04-067'),instance('hBP09-064')]};
  if(opponentSubaru)opponent.zones.back1=unit('hBP04-067');
  opponent.zones.center=unit(target);
  const state={status:'playing',phase:'performance',turn:3,activePlayer:0,firstPlayer:1,players:[own,opponent],effectQueue:[],pendingChoice:null,log:[],knockouts:[],lifeLosses:[]};
  return applyAction(state,0,{type:'attack',sourceZone,artIndex:0,targetZone:'center'},cards,()=>0.25);
}

try{
  for(const number of ['hBP09-050','hBP04-067','hBP09-064','hBP04-072','hBP02-064','hY01-015'])if(!map.has(number))throw new Error(`Current catalog is missing ${number}`);
  const base=useArt({opponentSubaru:true});
  const oneOwn=useArt({subaruZones:['collab'],opponentSubaru:true});
  const threeOwnAndPurple=useArt({subaruZones:['collab','back1','back2'],target:'hBP02-064'});
  const centerBackTopAndCovered=useArt({sourceZone:'collab',subaruZones:['back1','back2'],opponentSubaru:true,coveredSubaru:true,target:'hBP02-064'});
  const results=[
    {case:'base 100; an opposing Subaru does not count',damage:base.players[1].zones.center.damage,expected:100},
    {case:'one own Collab Subaru adds 20',damage:oneOwn.players[1].zones.center.damage,expected:120},
    {case:'three own Subaru add 60 and a purple target adds 50',damage:threeOwnAndPurple.players[1].zones.center.damage,expected:210},
    {case:'Center and two Back top-card Subaru add 60; covered and opposing Subaru do not count; purple adds 50',damage:centerBackTopAndCovered.players[1].zones.center.damage,expected:210},
  ];
  for(const item of results)if(item.damage!==item.expected)throw new Error(`${item.case}: got ${item.damage}, expected ${item.expected}`);
  status.textContent='PASS: hBP09-050 Arts counts each own Subaru across Collab/Back and stacks the purple-target +50 correctly.';
  output.textContent=JSON.stringify({pass:true,results},null,2);
}catch(error){
  status.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;
  output.textContent=JSON.stringify({pass:false,error:String(error)},null,2);
}
