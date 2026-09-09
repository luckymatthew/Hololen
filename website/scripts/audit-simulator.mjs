// Reproducible mechanics audit. A routing hit or base-damage check never certifies
// a card's conditional effect, trigger, cost payment or full resolution.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,unit,dummy,state,attack,fund } from '../tests/fixtures/simulator-audit.mjs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('lib/simulator/engine.mjs',root),'utf8');
const reviewed=JSON.parse(readFileSync(new URL('docs/effect-audit/reconciled.json',root)));
const testFiles=readdirSync(new URL('tests/',root)).filter(f=>/^simulator.*\.test\.mjs$/.test(f)||f==='oshi-skill-regression.test.mjs').sort();
const testText=testFiles.map(f=>readFileSync(new URL('tests/'+f,root),'utf8')).join('\n');
const scenarioEvidence=JSON.parse(readFileSync(new URL('docs/simulator-audit/scenario-evidence.json',root)));
const result=[];const failures=[];let baseCases=0,plainCases=0;
const colors=['白','綠','紅','藍','紫','黃','無色'];
for(const card of cards){
 const fields=reviewed.filter(r=>r.card===card.number).map(r=>({path:r.path,textSourceStatus:r.status,executionStatus:'未完成逐條結算驗證'}));
 const record={number:card.number,name:card.name,fullBehaviorVerified:false,scenarioEvidence:scenarioEvidence[card.number]||[],effects:fields,engineReferences:source.split('\n').flatMap((l,i)=>l.includes('"'+card.number+'"')||l.includes('"'+card.number+':')?[i+1]:[]),mentionedInTests:testText.includes(card.number),baseDamageChecks:[],plainArtChecks:[]};
 for(let i=0;i<card.arts.length;i++){
  const art=card.arts[i];
  for(const color of colors){
   // Isolate generic damage mechanics with the actual stored cost/damage/bonus.
   const proxy={...card,number:'BASE-'+card.number,keyword:null,arts:card.arts.map(a=>({...a,effect:''}))};
   const target={...dummy,colors:[color]};
   const s=state(proxy.number);fund(s.players[0].zones.center,art.cost);
   let actual=null,error=null;
   const expected=art.damage+(art.specialTargets||[]).reduce((n,c,k)=>n+(c===color?Number(art.specialValues[k]):0),0);
   try {actual=applyAction(s,0,{...attack,artIndex:i},[...pool.filter(c=>c.number!==dummy.number),target,proxy],()=>0.5).players[1].zones.center.damage;}catch(e){error=e.message;}
   const pass=!error&&actual===expected;
   const check={path:`arts.${i}`,targetColor:color,expected,actual,pass,error,scope:'僅基礎傷害、特攻與足夠聲援；隔離所有卡片效果'};
   record.baseDamageChecks.push(check);baseCases++;if(!pass)failures.push({card:card.number,...check});
  }
  if(!art.effect && card.keyword?.type!=='gift'){
   const s=state(card.number);fund(s.players[0].zones.center,art.cost);
   try {
    const end=applyAction(s,0,{...attack,artIndex:i},pool,()=>0.5);
    const check={path:`arts.${i}`,expected:art.damage,actual:end.players[1].zones.center.damage,pendingChoice:!!end.pendingChoice};check.pass=check.actual===check.expected&&!check.pendingChoice;
    record.plainArtChecks.push(check);plainCases++;if(!check.pass)failures.push({card:card.number,scope:'真實卡號無附加效果藝能',...check});
   }catch(e){const check={path:`arts.${i}`,pass:false,error:e.message};record.plainArtChecks.push(check);failures.push({card:card.number,...check});}
  }
 }
 result.push(record);
}
const summary={date:'2026-09-05',cards:cards.length,effectFields:reviewed.length,baseCases,plainCases,failures:failures.length,fullBehaviorVerifiedCards:0,scopedScenarioCards:Object.keys(scenarioEvidence).length,latestBatch:Math.max(0,...Object.values(scenarioEvidence).flat().map(entry=>Number(entry.batch||0))),warning:'文字校對不等於引擎校對；程式引用或測試提及亦不代表該卡完整效果已驗證。'};
const out=new URL('docs/simulator-audit/',root);mkdirSync(out,{recursive:true});
writeFileSync(new URL('ledger.json',out),JSON.stringify(result,null,2));writeFileSync(new URL('summary.json',out),JSON.stringify(summary,null,2));writeFileSync(new URL('failures.json',out),JSON.stringify(failures,null,2));
console.log(JSON.stringify(summary,null,2));console.log(JSON.stringify(failures.slice(0,20),null,2));
if(failures.length)process.exitCode=1;
