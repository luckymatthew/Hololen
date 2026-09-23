import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,cards} from './hbp09-fixtures.mjs';
import {applyAction,publicRoomState} from '../lib/simulator/engine.mjs';
import {chooseAiAction} from '../lib/simulator/ai.mjs';
import {captureEntropy,replayEntropy} from '../lib/simulator/review-entropy.mjs';
import {newRecording,appendRecording,reconstruct,restoreRecording,exportFiles,stateHash} from '../lib/simulator/battle-diagnostics.mjs';
import {reviewZip} from '../lib/simulator/review-download.mjs';
const provenance={engineVersion:'test',catalogVersion:'test',policyVersion:'test',appBuild:'test',platform:'node'};

test('upgrading a saved match preserves prior records and marks its new runtime boundary',()=>{
 const state=fixture(),recording=newRecording(state,1,'upgrade-review',provenance);
 const restored=restoreRecording(recording,state,1,'upgrade-review',{...provenance,appBuild:'next'});
 assert.equal(restored.versions.length,2);assert.equal(restored.versions[1].fromRevision,2);
 assert.equal(restored.versions[0].provenance.appBuild,'test');assert.equal(restored.provenance.appBuild,'next');
 assert.equal(stateHash(reconstruct(restored)),stateHash(state));
 assert.equal(restoreRecording(restored,state,1,'upgrade-review',restored.provenance).versions.length,2);
});
test('web diagnostics keep schema-1 state readable and replay actual entropy without policy probes',()=>{
 const before=fixture();before.mode='solo';const telemetry={};
 const action=chooseAiAction(before,0,cards,new Set(),{telemetry});assert.ok(action);
 const captured=captureEntropy(()=>applyAction(before,0,action,cards));
 const replayed=replayEntropy(captured.tape,()=>applyAction(before,0,action,cards,()=>{throw Error('Missing entropy')}));
 assert.equal(stateHash(replayed),stateHash(captured.result));
 const recording=appendRecording(newRecording(before,1,'web-review',provenance),before,captured.result,2,action,telemetry,captured.tape);
 assert.equal(stateHash(reconstruct(recording)),stateHash(captured.result));
 const files=exportFiles({schema:1,revision:2,matchId:'web-review',state:captured.result,battleDiagnostics:recording,token:'TRANSPORT_SECRET'});
 assert.ok(!JSON.stringify(files).includes('TRANSPORT_SECRET'));
 const review=JSON.parse(files['ai-review.json']);assert.equal(review.decisions.length,1);assert.ok(review.decisions[0].chosenActionId);
 const view=publicRoomState(captured.result,1);assert.equal(view.battleDiagnostics,undefined);assert.equal(view.players[0].mainDeck,undefined);
});
test('ZIP uses a fixed allowlist, UTF-8 and real local/central directory records',()=>{
 const files={'match.json':'{"matchId":"測試"}','ai-review.json':'{}','manifest.json':'{}','README.txt':'Offline'};
 const bytes=reviewZip(files),v=new DataView(bytes.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);assert.equal(v.getUint16(bytes.length-14,true),4);
 let offset=0;for(const [name,text]of Object.entries(files)){const view=new DataView(bytes.buffer,offset),size=view.getUint32(18,true),length=view.getUint16(26,true);assert.equal(new TextDecoder().decode(bytes.slice(offset+30,offset+30+length)),name);assert.equal(new TextDecoder().decode(bytes.slice(offset+30+length,offset+30+length+size)),text);offset+=30+length+size;}
 assert.throws(()=>reviewZip({'../profile.json':'secret'}),/Invalid/);
});
test('web policy ignores changed opponent hidden identities and diagnostic blobs',()=>{
 const a=fixture(),b=structuredClone(a);b.offline={decks:'SECRET'};b.battleDiagnostics={debug:'SECRET'};
 for(const key of ['hand','mainDeck','holoPower','life','cheerDeck'])b.players[1][key]=b.players[1][key].map((c,i)=>({id:'hidden-'+i,number:'hBP09-001'}));
 const ta={},tb={};assert.deepEqual(chooseAiAction(a,0,cards,new Set(),{telemetry:ta}),chooseAiAction(b,0,cards,new Set(),{telemetry:tb}));assert.deepEqual(ta.actions,tb.actions);
});
