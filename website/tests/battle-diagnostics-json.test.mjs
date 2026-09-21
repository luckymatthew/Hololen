import test from 'node:test';
import assert from 'node:assert/strict';
import {clone,difference,applyDifference,stateHash,newRecording,appendRecording,reconstruct,reviewDocument,restoreRecording,reviewBudget} from '../lib/simulator/battle-diagnostics.mjs';
const provenance={engineVersion:'test',catalogVersion:'test',policyVersion:'test',appBuild:'test',platform:'node'};
const persisted=x=>JSON.parse(JSON.stringify(x));
test('diagnostic patches match persisted JSON for omitted fields, deletion, null and arrays',()=>{
 const cases=[
  [{pendingChoice:{type:'cardSelection'}},{pendingChoice:{type:'eventCheerTarget',cheerCard:undefined}}],
  [{value:1},{value:undefined}], [{value:undefined},{value:null}], [{value:null},{}],
  [{nested:{a:1,b:2}},{nested:{a:undefined,c:3}}],
  [{array:[1,2,3]},{array:[undefined,,null,{omitted:undefined,kept:0}]}],
  [{array:[null]},{array:undefined}], [{array:undefined},{array:[undefined]}],
 ];
 for(const [before,after]of cases){
  const delta=persisted(difference(before,after));
  assert.deepEqual(applyDifference(persisted(before),delta),persisted(after));
  assert.equal(stateHash(applyDifference(before,delta)),stateHash(after));
 }
 assert.equal(clone(undefined),undefined);
 assert.deepEqual(difference({value:1},{value:undefined}),[{path:['value'],remove:true}]);
 assert.deepEqual(difference({},{value:undefined}),[]);
 assert.throws(()=>applyDifference({},[{path:['__proto__','polluted'],value:true}]),/Unsafe/);
 assert.equal({}.polluted,undefined);
});
test('recording undefined optional target fields survives serialization, reconstruction and restore',()=>{
 const before={mode:'solo',pendingChoice:{type:'cardSelection'}},after={mode:'solo',pendingChoice:{type:'eventCheerTarget',cheerCard:undefined}};
 const r=appendRecording(newRecording(before,169,'optional-cheer',provenance),before,after,170,{type:'choose'},null,[]);
 const saved=persisted(r);assert.deepEqual(reconstruct(saved),persisted(after));
 assert.equal(restoreRecording(saved,persisted(after),170,'optional-cheer',provenance).lastRevision,170);
});
test('full history rotation retains bounded truthful chosen-action summaries and replay baseline',()=>{
 let state={mode:'solo',count:0,status:'playing'},r=newRecording(state,1,'long-match',provenance,{maxRecords:2,maxCharacters:12000,maxDecisionSummaries:3});
 for(let i=1;i<=12;i++){
  const next={...state,count:i},t={turn:i,phase:'main',seat:1,observation:{count:i},pendingChoice:null,
   actions:[{action:{type:'choose',zone:'back1'},score:i},{action:{type:'choose',zone:'center'},score:-1}],chosenIndex:0,
   nodes:2,samples:1,depth:1,elapsedMs:5,budget:{nodes:2},invalidNodes:0,defensiveNodes:2};
  r=appendRecording(r,state,next,i+1,{type:'choose'},t,[]);state=next;
 }
 assert.equal(r.records.length,2);assert.equal(r.decisionSummaries.length,3);assert.equal(r.droppedDecisionSummaries,7);
 assert.equal(r.droppedDecisions,10);assert.deepEqual(reconstruct(persisted(r)),state);
 assert.ok(JSON.stringify(r).length<=r.limits.maxCharacters);
 const review=reviewDocument(r,state);assert.equal(review.capture.complete,false);
 assert.equal(review.replay.initialStateRef,'match.json#/battleDiagnostics/baseline');
 assert.equal(review.replay.entropyCapture,'complete');assert.equal(review.replay.verified,false);
 assert.equal(review.decisions.length,5);const summary=review.decisions[0];
 assert.equal(summary.candidates.length,1);assert.equal(summary.candidates[0].score,8);
 assert.ok(summary.reasonCodes.includes('candidate_details_not_retained'));
 assert.equal(summary.search.budget.measured.defensiveNodes,2);
 assert.equal(r.decisionSummaries[0].telemetry.observation.available,false);
 assert.deepEqual(r.decisionSummaries[0].telemetry.actions[0].action,{type:'choose',zone:'back1'});
});
test('missing legacy entropy stays partial and oversized baseline is explicitly marked',()=>{
 let state={mode:'solo',count:0},r=newRecording(state,20,'legacy',provenance);
 r=appendRecording(r,state,{...state,count:1},21,{},null,null);state={...state,count:1};
 r=appendRecording(r,state,{...state,count:2},22,{},null,[]);
 assert.equal(reviewDocument(r,state).replay.entropyCapture,'partial');
 const huge={mode:'solo',text:'x'.repeat(4000)};
 const bounded=appendRecording(newRecording(huge,1,'oversized',provenance,{maxCharacters:1000}),huge,{...huge,count:1},2,{});
 assert.equal(bounded.retentionLimitExceeded,'baseline_and_initial_state');
 assert.equal(reconstruct(bounded).count,1);assert.equal(bounded.records.length,0);
});
test('review metrics preserve measured search work and omit unavailable fast-path timings',()=>{
 const actual={invalidNodes:2,duplicateStates:3,defensiveNodes:4,exhaustedSamples:1,budgetExhausted:true,forced:false,cacheHit:false,
  generatedCandidates:19,candidateMs:11,evaluationMs:12,simulationMs:13,evaluationCacheHits:5,evaluatedNodes:22,terminationReasons:['node_budget','depth_limit']};
 assert.deepEqual(reviewBudget({...actual,budget:{nodes:24,samples:2}}),{nodes:24,samples:2,measured:actual});
 assert.deepEqual(reviewBudget({budget:{nodes:24},forced:true,cacheHit:false}),{nodes:24,measured:{forced:true,cacheHit:false}});
 assert.deepEqual(reviewBudget({budget:{nodes:24}}),{nodes:24});
});
