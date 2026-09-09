import { readFileSync } from 'node:fs';
export const cards = JSON.parse(readFileSync(new URL('../../public/cards.json', import.meta.url))).cards;
export const inst = (number, id=number) => ({number,id});
export const unit = (number, options={}) => ({stack:[inst(number)],cheer:[],attachments:[],damage:0,rested:false,enteredTurn:0,bloomedTurn:0,collabbedTurn:0,returnSlot:null,...options});
export const dummy = {number:'AUDIT-DUMMY',name:'Audit dummy',jpName:'Audit dummy',group:'holomem',stage:'Debut',hp:10000,colors:[],tags:[],arts:[{name:'Audit damage',damage:100,cost:[],effect:''}]};
export const oshi={number:'AUDIT-OSHI',name:'Audit oshi',group:'oshi',colors:[],life:5,arts:[]};
export const pool=[...cards,dummy,oshi];
export function player(number, options={}) {
 return {name:number,ready:true,setupDone:true,oshi:inst(oshi.number),mainDeck:Array.from({length:30},(_,i)=>inst(dummy.number,number+'deck'+i)),cheerDeck:[],hand:[],life:Array.from({length:5},(_,i)=>inst('hY01-001',number+'life'+i)),holoPower:[],archive:[],zones:{center:unit(number),collab:null,back1:null,back2:null,back3:null,back4:null,back5:null},collabTurn:0,batonTurn:0,limitedTurn:0,turnsTaken:2,mulliganUsed:false,forcedRedraws:0,...options};
}
export function state(source=dummy.number,target=dummy.number){return {status:'playing',players:[player(source),player(target)],activePlayer:0,firstPlayer:0,winner:null,turn:3,phase:'performance',pendingChoice:null,log:[]};}
export const attack={type:'attack',sourceZone:'center',targetZone:'center',artIndex:0};
export function fund(u,cost) {
 const numbers={'白':'hY01-001','綠':'hY02-001','紅':'hY03-001','藍':'hY04-001','紫':'hY05-001','黃':'hY06-001','無色':'hY01-001'};
 u.cheer=cost.map((c,i)=>inst(numbers[c],`cheer${i}`));
}
