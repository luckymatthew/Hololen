import fs from 'node:fs';
import {reconstruct,applyDifference,stateHash} from '../lib/simulator/battle-diagnostics.mjs';
const [input,revisionText,output]=process.argv.slice(2);
if(!input)throw Error('Usage: node scripts/review-battle.mjs match.json [revision] [output.json]');
const saved=JSON.parse(fs.readFileSync(input,'utf8')),r=saved.battleDiagnostics;
if(r?.schemaVersion!=='hololens.battle-diagnostics.v2'){
 console.log(JSON.stringify({matchId:saved.matchId||null,legacy:true,reconstructionVerified:false,reason:'Historical diagnostic implementation/schema unavailable; original match remains readable and unchanged.'}));
}else{
 reconstruct(r);let state=r.baseline,revision=r.baselineRevision;
 const wanted=revisionText==null?r.lastRevision:Number(revisionText);
 if(!Number.isSafeInteger(wanted)||wanted<r.baselineRevision||wanted>r.lastRevision)throw Error('Revision outside retained range');
 for(const row of r.records){if(row.revisionAfter>wanted)break;state=applyDifference(state,row.delta);revision=row.revisionAfter;}
 if(output)fs.writeFileSync(output,JSON.stringify({...saved,state,revision,battleDiagnostics:undefined},null,2));
 console.log(JSON.stringify({matchId:r.matchId,revision,retainedFrom:r.baselineRevision,dropped:r.droppedRecords,stateHash:stateHash(state),reconstructionVerified:true,engineReplayVerified:false}));
}
