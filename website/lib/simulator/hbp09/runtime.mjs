/** hBP09 deterministic continuation runtime. No source-text interpretation, eval,
 * timers, network calls or player-choice guessing. State and continuations are JSON.
 * Host callbacks use the existing simulator's damage, healing and trigger rules. */
export const VERSION = 'hbp09-executable-20260918.1';
export const SLOTS = ['center','collab','back1','back2','back3','back4','back5'];
export const top = u => u?.stack?.[u.stack.length - 1] || null;
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (ok, message) => { if (!ok) throw new Error(`hBP09: ${message}`); };
export function createRuntime(host) {
  function playerIndex(context, owner) {
    return Number.isInteger(owner) ? owner : owner === 'opponent' ? 1-context.playerIndex : context.playerIndex;
  }
  function sourceUnit(state, context) {
    return SLOTS.map(zone => ({owner:context.playerIndex,zone,unit:state.players[context.playerIndex].zones[zone]}))
      .find(x => x.unit && (top(x.unit)?.id === context.sourceId || x.unit.stack?.[0]?.id === context.sourceBaseId)) || null;
  }
  function cardMatches(card, rule = {}, state, context, map) {
    if (!card) return false;
    if (rule.any && !rule.any.some(r => cardMatches(card,r,state,context,map))) return false;
    if (rule.not && cardMatches(card,rule.not,state,context,map)) return false;
    if (rule.group && card.group !== rule.group) return false;
    if (rule.names && !rule.names.some(n => host.cardHasName(card,n === '$oshi' ? map.get(state.players[context.playerIndex].oshi.number)?.jpName : n))) return false;
    if (rule.numbers && !rule.numbers.includes(card.number)) return false;
    if (rule.stages && !rule.stages.includes(card.stage)) return false;
    if (rule.notDebut && card.stage === 'Debut') return false;
    if (rule.buzzOrSecond && !(host.cardIsBuzz(card) || card.stage === '2nd')) return false;
    if (rule.tags && !rule.tags.every(t => host.cardHasTag(card,t))) return false;
    if (rule.colors && !(card.colors || []).some(c => rule.colors.includes(c))) return false;
    if (rule.typeCodes && !rule.typeCodes.includes(card.typeCode)) return false;
    if (rule.limited != null && /limited/i.test(card.typeCode || card.type || '') !== rule.limited) return false;
    if (rule.keyword && card.keyword?.type !== rule.keyword) return false;
    if (rule.baton != null && Number(card.baton || 0) !== rule.baton) return false;
    return true;
  }
  function refs(state, context, selector = {}, map) {
    if (selector.ref) { const value=context.vars?.[selector.ref]; return Array.isArray(value)?value:value?[value]:[]; }
    const owner=playerIndex(context,selector.owner); const p=state.players[owner];
    let result=[];
    if (selector.area === 'stage') {
      result=SLOTS.flatMap(zone => {
        const unit=p.zones[zone]; if (!unit) return [];
        if (selector.zones && !selector.zones.includes(zone)) return [];
        if (selector.back && !zone.startsWith('back')) return [];
        if (selector.excludeSource && (top(unit)?.id === context.sourceId || unit.stack?.[0]?.id === context.sourceBaseId)) return [];
        if (selector.hasCheer && !unit.cheer.length) return [];
        if (selector.bloomedThisTurn && unit.bloomedTurn !== state.turn) return [];
        if (selector.attachment && !(unit.attachments||[]).some(a=>cardMatches(map.get(a.number),selector.attachment,state,context,map))) return [];
        return [{...top(unit),owner,area:'stage',zone}];
      });
    } else if (selector.area === 'cheer' || selector.area === 'attachments') {
      const stage=refs(state,context,{area:'stage',owner,rule:selector.stageRule,zones:selector.zones,back:selector.back},map);
      result=stage.flatMap(s => (p.zones[s.zone][selector.area]||[]).map(c=>({...c,owner,area:selector.area,zone:s.zone})));
      if (selector.sourceOnly) { const s=sourceUnit(state,context); result=result.filter(r=>s && r.owner===s.owner && r.zone===s.zone); }
    } else {
      const area=selector.area || 'mainDeck';
      fail(Array.isArray(p[area]),`Unknown area ${area}`);
      const list=selector.top == null?p[area]:p[area].slice(0,Number(value(state,context,selector.top,map)));
      result=list.map(c=>({...c,owner,area}));
    }
    if (selector.rule) result=result.filter(r=>cardMatches(map.get(r.number),selector.rule,state,context,map));
    if (selector.excludeRef) { const excluded=refs(state,context,{ref:selector.excludeRef},map); result=result.filter(r=>!excluded.some(e=>e.id===r.id)); }
    return result;
  }
  function value(state,c,x,map) {
    if (x == null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(v=>value(state,c,v,map));
    if (x.ref) return refs(state,c,x,map);
    if (x.var) return c.vars?.[x.var];
    if (x.count) return refs(state,c,x.count,map).length;
    if (x.source) { const s=sourceUnit(state,c); return s?[{...top(s.unit),owner:s.owner,area:'stage',zone:s.zone}]:[]; }
    if (x.numberOfSelected) return refs(state,c,{ref:x.numberOfSelected},map).length;
    if (x.op) {
      const a=(x.args||[]).map(v=>value(state,c,v,map));
      switch(x.op) {
        case 'add':return a.reduce((s,n)=>s+Number(n),0);
        case 'mul':return a.reduce((s,n)=>s*Number(n),1);
        case 'eq':return a[0]===a[1];case 'gte':return a[0]>=a[1];case 'gt':return a[0]>a[1];case 'lt':return a[0]<a[1];case 'lte':return a[0]<=a[1];
        case 'and':return a.every(Boolean);case 'or':return a.some(Boolean);case 'not':return !a[0];
        case 'mod':return a[0]%a[1];case 'choose':return a[0]?a[1]:a[2];
        default:throw new Error(`Unknown expression ${x.op}`);
      }
    }
    if (x.fact) {
      const p=state.players[c.playerIndex],q=state.players[1-c.playerIndex],s=sourceUnit(state,c);
      switch(x.fact) {
        case 'secondFirst':return c.playerIndex!==state.firstPlayer && Number(p.turnsTaken)===1;
        case 'oshiName':return host.cardHasName(map.get(p.oshi?.number),x.name);
        case 'oshiColor':return (map.get(p.oshi?.number)?.colors||[]).includes(x.color);
        case 'sourceZone':return s?.zone || c.sourceZone;
        case 'sourceStage':return map.get(s&&top(s.unit)?.number)?.stage;
        case 'sourceCheer':return s?.unit.cheer.length||0;
        case 'sourceRemainingHp':return s?host.stageRemainingHp(p,s.zone,map):0;
        case 'power':return p.holoPower.length;
        case 'handOpponent':return q.hand.length;
        case 'stageCount':return refs(state,c,{area:'stage'},map).length;
        case 'baton':return p.batonTurn===state.turn;
        case 'opponentTurn':return state.activePlayer!==c.playerIndex;
        case 'previousDowns':return (state.knockouts||[]).filter(k=>k.ownerIndex===c.playerIndex && k.turn===state.turn-1 && k.sourcePlayerIndex===1-c.playerIndex).length;
        case 'artsCount':return (p.turnEvents?.turn===state.turn?p.turnEvents.arts:[])?.length||0;
        case 'singingArtsCount':return (p.turnEvents?.turn===state.turn?p.turnEvents.arts:[])?.filter(n=>host.cardHasTag(map.get(n),'#歌')).length||0;
        case 'archiveBloom':return p.hbp09ArchiveBloomTurn===state.turn;
        case 'allMatsuri':return refs(state,c,{area:'stage'},map).every(r=>host.cardHasName(map.get(r.number),'夏色まつり'));
        case 'threeIdColors':return ['綠','藍','黃'].every(col=>refs(state,c,{area:'cheer',rule:{colors:[col]}},map).length);
        case 'selectedStage':return map.get(refs(state,c,{ref:x.ref},map)[0]?.number)?.stage;
        case 'selectedMatches':return refs(state,c,{ref:x.ref},map).some(r=>cardMatches(map.get(r.number),x.rule,state,c,map));
        default:throw new Error(`Unknown fact ${x.fact}`);
      }
    }
    return x;
  }
  function locate(state,ref) {
    const p=state.players[ref.owner];if (!p) return null;
    if (ref.area==='stage') { const zone=SLOTS.find(z=>top(p.zones[z])?.id===ref.id);return zone?{unit:p.zones[zone],zone,owner:ref.owner}:null; }
    if (ref.area==='cheer'||ref.area==='attachments') {
      for(const zone of SLOTS){const list=p.zones[zone]?.[ref.area];const i=list?.findIndex(c=>c.id===ref.id);if(i>=0)return{list,index:i,zone,owner:ref.owner};}
      return null;
    }
    const list=p[ref.area];const index=list?.findIndex(c=>c.id===ref.id);return index>=0?{list,index,owner:ref.owner}:null;
  }
  function take(state,ref) { const found=locate(state,ref);fail(found?.list,`Card moved before resolution: ${ref.id}`);return found.list.splice(found.index,1)[0]; }
  function targetRefs(state,c,target,map) { return target?.area?refs(state,c,target,map):(value(state,c,target,map)||[]); }
  function context(state,i,number,zone='',data={}) {
    const u=state.players[i]?.zones?.[zone];return {playerIndex:i,sourceNumber:number,sourceZone:zone,sourceId:top(u)?.id||'',sourceBaseId:u?.stack?.[0]?.id||'',vars:{},...copy(data)};
  }
  function enqueue(state,c,steps) {host.enqueueEffect(state,{type:'hbp09Program',playerIndex:c.playerIndex,context:copy(c),steps:copy(steps)});}
  function once(state,c,key){const p=state.players[c.playerIndex];p.namedUsageTurns||={};const k=`hbp09:${key}`;if(p.namedUsageTurns[k]===state.turn)return false;p.namedUsageTurns[k]=state.turn;return true;}
  function prompt(state,c,op,remaining,map) {
    const ctx=copy(c),owner=playerIndex(c,op.owner),kind=op.op;
    if(kind==='chooseCards') {
      const cards=refs(state,c,op.from,map);const max=Math.min(Number(value(state,c,op.max??1,map)),cards.length);
      const required=Number(value(state,c,op.min??1,map));
      if(op.cost && cards.length<required){return false;}
      if(!cards.length){c.vars[op.key]=[];return false;}
      const min=op.search||op.optional?0:Math.min(required,max);
      state.pendingChoice={type:'cardSelection',playerIndex:owner,cards:copy(cards),selectableIds:cards.map(r=>r.id),min,max,optional:!!op.optional,source:op.from.area||'',prompt:op.prompt||`${c.sourceNumber}：選擇卡片（依選取次序）`,effect:'hbp09',meta:{hbp09:{context:ctx,op:copy(op),remaining:copy(remaining)}}};
    } else if(kind==='chooseUnit') {
      const options=refs(state,c,{area:'stage',...op.from},map);
      if(!options.length){c.vars[op.key]=[];return false;}
      state.pendingChoice={type:'stageTarget',playerIndex:owner,targetPlayerIndex:options[0].owner,options:options.map(r=>r.zone),optional:!!op.optional,prompt:op.prompt||`${c.sourceNumber}：選擇舞台目標`,effect:'hbp09',meta:{hbp09:{context:ctx,op:copy(op),remaining:copy(remaining),candidates:copy(options)}}};
    } else if(kind==='chooseOption') {
      state.pendingChoice={type:'optionChoice',playerIndex:owner,options:[],modeOptions:copy(op.options),optional:!!op.optional,prompt:op.prompt||`${c.sourceNumber}：選擇效果`,effect:'hbp09',meta:{hbp09:{context:ctx,op:copy(op),remaining:copy(remaining)}}};
    } else throw new Error('Unknown prompt');
    return true;
  }
  function run(state,ctx,input,map,random) {
    const c=ctx;c.vars||={};const steps=copy(input);let count=0;
    while(steps.length && state.status!=='finished') {
      fail(++count<=2000,'Effect instruction limit exceeded');
      const o=steps.shift();const p=state.players[c.playerIndex];
      const n=x=>Number(value(state,c,x,map)||0);
      if(o.op==='if'){if(value(state,c,o.when,map))steps.unshift(...copy(o.then||[]));else steps.unshift(...copy(o.else||[]));continue;}
      if(o.op==='once'){if(once(state,c,o.key||c.sourceNumber))steps.unshift(...copy(o.then||[]));continue;}
      if(['chooseCards','chooseUnit','chooseOption'].includes(o.op)){
        if(prompt(state,c,o,steps,map))return;
        steps.unshift(...copy(o.empty||[]));continue;
      }
      if(o.op==='set'){c.vars[o.key]=copy(value(state,c,o.value,map));continue;}
      if(o.op==='draw'){host.drawCards(state,playerIndex(c,o.owner),Math.max(0,n(o.amount)));continue;}
      if(o.op==='drawBottom'){const dest=state.players[playerIndex(c,o.owner)];for(let j=0;j<n(o.amount);j++){if(!dest.mainDeck.length){host.drawCards(state,playerIndex(c,o.owner),1);break;}dest.hand.push(dest.mainDeck.pop());}continue;}
      if(o.op==='powerTop'){for(let j=0;j<n(o.amount)&&p.mainDeck.length;j++)p.holoPower.push(p.mainDeck.shift());continue;}
      if(o.op==='shuffle'){const dest=state.players[playerIndex(c,o.owner)];dest[o.area]=host.shuffle(dest[o.area],random);continue;}
      if(o.op==='roll'){const result=host.rollDie(random,state,c.playerIndex,1,map.get(c.sourceNumber));c.vars[o.key]=result;continue;}
      if(o.op==='forEach'){const list=targetRefs(state,c,o.items,map);steps.unshift(...list.flatMap(item=>[{op:'set',key:o.key||'item',value:[item]},...copy(o.then)]));continue;}
      if(o.op==='move') {
        const chosen=targetRefs(state,c,o.cards,map);const moved=chosen.filter(r=>locate(state,r)).map(r=>take(state,r));
        const dest=state.players[playerIndex(c,o.owner)];
        if(o.to==='deckTop')dest.mainDeck.unshift(...moved);else if(o.to==='deckBottom')dest.mainDeck.push(...moved);else{fail(Array.isArray(dest[o.to]),'Invalid move destination');dest[o.to].push(...moved);}
        if(o.reveal&&moved.length)host.appendLog(state,`${c.sourceNumber} 公開所選卡片。`,moved,{reveal:true});
        if(o.to==='archive' && chosen.some(r=>r.area==='cheer'))host.triggerCheerArchivedGift(state,c.playerIndex,map,chosen.filter(r=>r.area==='cheer').length);
        if(o.save)c.vars[o.save]=moved.map(r=>({...r,owner:playerIndex(c,o.owner),area:o.to==='deckTop'||o.to==='deckBottom'?'mainDeck':o.to}));
        continue;
      }
      if(o.op==='buff'||o.op==='heal'||o.op==='damage'||o.op==='rest'||o.op==='treatStage') {
        for(const ref of targetRefs(state,c,o.target,map)){
          const t=locate(state,ref);if(!t?.unit)continue;
          if(o.op==='buff')host.addStageModifier(t.unit,o.kind||'arts',n(o.amount),state.turn+Number(o.duration||0),c.sourceNumber);
          if(o.op==='heal')host.healStageUnit(state,t.owner,t.zone,Math.max(0,n(o.amount)),map,true);
          if(o.op==='damage')host.applySpecialDamage(state,c.playerIndex,t.owner,t.zone,Math.max(0,n(o.amount)),map,{sourceZone:c.sourceZone,sourceCardNumber:c.sourceNumber,sourceName:c.sourceNumber});
          if(o.op==='rest'){t.unit.rested=true;if(o.skipReset)t.unit.skipUnrestTurn=state.turn+1;}
          if(o.op==='treatStage'){t.unit.hbp09Stage={stage:o.stage,expiresTurn:state.turn};}
        }continue;
      }
      if(o.op==='playerBuff'){host.addPlayerModifier(p,o.kind,n(o.amount),state.turn+Number(o.duration||0),c.sourceNumber,o.rule||{});continue;}
      if(o.op==='attach'){
        const target=targetRefs(state,c,o.target,map)[0],t=target&&locate(state,target);if(!t?.unit)continue;
        for(const ref of targetRefs(state,c,o.cards,map)){
          if(!locate(state,ref))continue;
          const card=map.get(ref.number),isCheer=card?.group==='cheer';
          if(!isCheer && !host.attachmentTargets(state.players[t.owner],card,map).includes(t.zone))continue;
          const instance=take(state,ref);
          if(isCheer)host.attachCheerCards(state,t.unit,[instance]);else{t.unit.attachments.push(instance);host.queueAttachmentEntryEffects(state,t.owner,t.zone,card,map,random,ref.area);}
          host.onAttach?.(state,t.owner,t.zone,instance,map,random);
        }continue;
      }
      if(o.op==='topCheer'){
        const target=targetRefs(state,c,o.target,map)[0],t=target&&locate(state,target);
        if(t?.unit&&p.cheerDeck.length)host.attachCheerCards(state,t.unit,[p.cheerDeck.shift()]);continue;
      }
      if(o.op==='look'){
        const cards=p.mainDeck.slice(0,n(o.amount)).map(r=>({...r,owner:c.playerIndex,area:'mainDeck'}));c.vars[o.key||'look']=cards;
        const selection={op:'chooseCards',from:{ref:o.key||'look'},min:0,max:o.max||1,search:true,key:'lookPick',prompt:`${c.sourceNumber}：查看並選擇加入手牌的卡片`,filter:o.rule,then:[{op:'move',cards:{ref:'lookPick'},to:'hand',reveal:true},{op:'orderRemaining',ref:o.key||'look',picked:'lookPick',destination:o.remainder||'deckBottom'}]};
        // Filter selected candidates, retain the whole looked-at set for ordering.
        c.vars.lookCandidates=cards.filter(r=>cardMatches(map.get(r.number),o.rule||{},state,c,map));selection.from={ref:'lookCandidates'};
        selection.empty=[{op:'orderRemaining',ref:o.key||'look',picked:'lookPick',destination:o.remainder||'deckBottom'}];
        steps.unshift(selection);continue;
      }
      if(o.op==='orderRemaining'){
        const picked=new Set((c.vars[o.picked]||[]).map(r=>r.id));const remaining=(c.vars[o.ref]||[]).filter(r=>!picked.has(r.id)&&locate(state,r));c.vars.orderCards=remaining;
        if(remaining.length)steps.unshift({op:'chooseCards',from:{ref:'orderCards'},min:remaining.length,max:remaining.length,key:'ordered',then:[{op:'move',cards:{ref:'ordered'},to:o.destination}]});continue;
      }
      if(o.op==='deploy'){
        const candidates=targetRefs(state,c,o.cards,map).filter(r=>locate(state,r));if(!candidates.length)continue;
        const zones=SLOTS.filter(z=>z.startsWith('back')&&!p.zones[z]);if(SLOTS.filter(z=>p.zones[z]).length>=6||!zones.length)continue;
        const next=candidates.shift();c.vars.deployRemaining=candidates;c.vars.deployCard=[next];
        steps.unshift({op:'chooseOption',key:'deployZone',options:zones.map(id=>({id,label:id})),then:[{op:'placeSelected'},{op:'deploy',cards:{ref:'deployRemaining'}}]});continue;
      }
      if(o.op==='placeSelected'){
        const zone=c.vars.deployZone,ref=c.vars.deployCard?.[0];fail(zone?.startsWith('back')&&!p.zones[zone]&&SLOTS.filter(z=>p.zones[z]).length<6,'Invalid stage placement');
        const instance=take(state,ref);p.zones[zone]=host.unit(instance,state.turn);host.queueStageEntryGiftEffects(state,c.playerIndex,zone,map.get(instance.number),map);continue;
      }
      if(o.op==='swapCollab'){
        const ref=targetRefs(state,c,o.target,map)[0],t=ref&&locate(state,ref);if(!t?.unit||!t.zone.startsWith('back'))continue;
        const owner=state.players[t.owner],old=owner.zones.collab;owner.zones.collab=t.unit;owner.zones[t.zone]=old||null;if(!old)t.unit.returnSlot=t.zone;continue;
      }
      if(o.op==='returnStage'){
        for(const ref of targetRefs(state,c,o.target,map)){const t=locate(state,ref);if(!t?.unit)continue;const owner=state.players[t.owner];owner.hand.push(...t.unit.stack);owner.archive.push(...t.unit.cheer,...t.unit.attachments);owner.zones[t.zone]=null;host.queueStageReturnGiftEffects(state,t.owner,t.unit.stack,map);}continue;
      }
      if(o.op==='viviReset'){
        for(const owner of state.players){const recycle=owner.archive.filter(r=>['holomem','support'].includes(map.get(r.number)?.group));const ids=new Set(recycle.map(r=>r.id));owner.archive=owner.archive.filter(r=>!ids.has(r.id));owner.mainDeck=host.shuffle([...owner.mainDeck,...owner.hand,...recycle],random);owner.hand=[];}
        host.drawCards(state,c.playerIndex,7);if(state.status!=='finished')host.drawCards(state,1-c.playerIndex,7);continue;
      }
      if(o.op==='limited'){p.limitedAllowanceTurn=state.turn;p.limitedAllowance=Math.max(Number(p.limitedAllowance||1),n(o.amount));continue;}
      if(o.op==='highestHp'){
        const entries=refs(state,c,{area:'stage'},map);const hp=entries.map(r=>host.stageRemainingHp(p,r.zone,map));const highest=Math.max(...hp);entries.forEach((r,i)=>{if(hp[i]===highest)host.addStageModifier(p.zones[r.zone],'arts',n(o.amount),state.turn,c.sourceNumber);});continue;
      }
      if(o.op==='adjustArt'){host.adjustQueuedArtsDamage(state,c.playerIndex,c.sourceZone,n(o.amount));continue;}
      if(o.op==='lifeLoss'){host.queueExtraLifeLoss(state,playerIndex(c,o.owner),c.playerIndex,map,c.sourceNumber);continue;}
      if(o.op==='flag'){p[o.key]=o.value==='turn'?state.turn:value(state,c,o.value,map);continue;}
      if(o.op==='notifyOshi'){host.queueGiftOshiSkillEffects(state,c.playerIndex,map.get(p.oshi.number)?.oshiSkill,'oshi',map);continue;}
      if(o.op==='log'){host.appendLog(state,`${c.sourceNumber}: ${o.message}`);continue;}
      if(host.customOp?.(state,c,o,steps,map,random))continue;
      throw new Error(`Unimplemented hBP09 instruction: ${o.op}`);
    }
  }
  function resolve(state,i,action,map,random) {
    const pending=state.pendingChoice;fail(pending?.effect==='hbp09'&&pending.playerIndex===i,'Choice belongs to another player');
    const data=pending.meta.hbp09,c=copy(data.context),o=data.op;const skipped=!!action.skip;
    fail(!skipped||pending.optional,'This choice cannot be skipped');let result;
    if(pending.type==='cardSelection'){
      const ids=skipped?[]:action.cardIds;fail(Array.isArray(ids),'cardIds required');fail(new Set(ids).size===ids.length,'Duplicate selected card');fail(skipped||(ids.length>=pending.min&&ids.length<=pending.max),'Wrong selection count');
      fail(ids.every(id=>pending.selectableIds.includes(id)),'Card was not selectable');result=ids.map(id=>pending.cards.find(r=>r.id===id));fail(result.every(r=>locate(state,r)),'Selected card has moved');
      if(o.cost&&!skipped)fail(result.length>=Number(value(state,c,o.min??1,map)),'The full optional cost must be paid');
    }else if(pending.type==='stageTarget'){
      const zone=action.zone||action.targetZone;result=skipped?[]:data.candidates.filter(r=>r.zone===zone);fail(skipped||(result.length===1&&locate(state,result[0])),'Invalid/stale stage target');
    }else if(pending.type==='optionChoice'){
      const id=action.optionId??action.option??action.mode??action.value;fail(skipped||pending.modeOptions.some(x=>x.id===id),'Invalid option');result=skipped?null:id;
    }else throw new Error('Unexpected hBP09 choice type');
    state.pendingChoice=null;c.vars[o.key]=result;
    const selected=Array.isArray(result)?result.length>0:result!=null;
    const tail=[...(!skipped && (!o.cost||selected)?o.then||[]:o.skipped||[]),...data.remaining];
    run(state,c,tail,map,random);
  }
  return {context,enqueue,run,resolve,refs,value,cardMatches,locate,sourceUnit,once};
}
