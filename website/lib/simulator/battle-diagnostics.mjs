// Offline diagnostic records are deliberately kept outside the game/policy state.
// No profile, transport token, device database or arbitrary directory is accepted.
export const REVIEW_BUILD = 'hololens-ai-review-v2-20260919';
export const clone = value => JSON.parse(JSON.stringify(value));
export function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(v => stable(v ?? null)).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
// Integrity checksum, not a cryptographic authentication claim. Build provenance
// uses SHA-256 generated from the actual source and catalog by the build script.
export function stateHash(value) {
  const text = stable(value); let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}
export function difference(before, after, path = [], output = []) {
  if (stable(before) === stable(after)) return output;
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!(key in after)) output.push({ path: [...path, key], remove: true });
      else if (!(key in before)) output.push({ path: [...path, key], value: clone(after[key]) });
      else difference(before[key], after[key], [...path, key], output);
    }
  } else output.push({ path, value: clone(after) });
  return output;
}
export function applyDifference(before, delta) {
  let result = clone(before);
  for (const change of delta) {
    if (change.path.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw Error('Unsafe diagnostic path');
    if (!change.path.length) { result = clone(change.value); continue; }
    let target = result;
    for (const key of change.path.slice(0, -1)) target = target[key];
    const key = change.path.at(-1);
    if (change.remove) delete target[key]; else target[key] = clone(change.value);
  }
  return result;
}
export function newRecording(state, revision, matchId, provenance, limits = {}) {
  return { schemaVersion: 'hololens.battle-diagnostics.v2', build: REVIEW_BUILD, matchId, provenance: clone(provenance),
    limits: { maxRecords: 2048, maxCharacters: 3 * 1024 * 1024, ...limits },
    initialState: clone(state), baseline: clone(state), baselineRevision: revision, baselineHash: stateHash(state),
    lastRevision: revision, droppedRecords: 0, droppedDecisions: 0, records: [], legacy: revision > 1,
    versions: [{ fromRevision: revision, provenance: clone(provenance) }] };
}
/** @param {any} recording @param {any} before @param {any} after @param {number} revision @param {any} action @param {any} telemetry @param {any} entropy */
export function appendRecording(recording, before, after, revision, action, telemetry = null, entropy = null) {
  const r = clone(recording);
  if (revision !== r.lastRevision + 1) throw Error('Diagnostic revision discontinuity');
  const lastHash = r.records.at(-1)?.afterHash || r.baselineHash;
  if (stateHash(before) !== lastHash) throw Error('Diagnostic baseline mismatch');
  r.records.push({ id: `${r.matchId}:${revision}`, revisionBefore: revision - 1, revisionAfter: revision,
    action: clone(action), beforeHash: lastHash, afterHash: stateHash(after), delta: difference(before, after),
    telemetry: telemetry ? clone(telemetry) : null, entropy: entropy ? clone(entropy) : null });
  r.lastRevision = revision;
  while (r.records.length && (r.records.length > r.limits.maxRecords || JSON.stringify(r).length > r.limits.maxCharacters)) {
    const old = r.records.shift(); r.baseline = applyDifference(r.baseline, old.delta);
    r.baselineRevision = old.revisionAfter; r.baselineHash = old.afterHash;
    r.droppedRecords++; r.droppedDecisions += Number(!!old.telemetry);
  }
  return r;
}
export function reconstruct(recording) {
  let state = clone(recording.baseline);
  if (stateHash(state) !== recording.baselineHash) throw Error('Diagnostic baseline hash mismatch');
  for (const row of recording.records) {
    if (stateHash(state) !== row.beforeHash) throw Error(`Broken diagnostic chain ${row.id}`);
    state = applyDifference(state, row.delta);
    if (stateHash(state) !== row.afterHash) throw Error(`Diagnostic state mismatch ${row.id}`);
  }
  return state;
}
export function restoreRecording(saved, state, revision, matchId, provenance) {
  if (!saved || saved.schemaVersion !== 'hololens.battle-diagnostics.v2') return newRecording(state, revision, matchId, provenance);
  if (saved.matchId !== matchId || saved.lastRevision !== revision || stateHash(reconstruct(saved)) !== stateHash(state)) throw Error('Saved diagnostics do not match the game');
  const result=clone(saved);
  if(stable(result.provenance)!==stable(provenance)){
    result.versions=result.versions||[{fromRevision:result.baselineRevision,provenance:result.provenance}];
    result.versions.push({fromRevision:revision+1,provenance:clone(provenance)});result.provenance=clone(provenance);
  }
  return result;
}
export function reviewDocument(recording, state) {
  const r = recording;
  return { schemaVersion: 'hololens.ai-review.v1', synthetic: false, matchId: r.matchId, mode: 'offline_ai', provenance: r.provenance,
    capture: { complete: !r.legacy && !r.droppedRecords, droppedDecisions: r.droppedDecisions, retainedFromRevision: r.baselineRevision,
      notes: ['Generated candidate subsets are not exhaustive legal-action sets.', 'Policy rerun determinism is not claimed.', ...((r.versions?.length||0)>1?['Runtime changed during resume; match.json records the version boundaries. Use each recorded version for engine replay.']:[]), ...(r.legacy ? ['Capture began after loading a legacy match; earlier decisions are unavailable.'] : [])] },
    visibility: { scope: 'offline_private', opponentHiddenIncluded: true, privilegedReplaySeparate: true },
    replay: { level: 'retained_states', entropyCapture: 'none', initialStateRef: 'match.json#/battleDiagnostics/initialState', actionLogRef: 'match.json#/battleDiagnostics/records', rngLogRef: null, verified: false, verificationEvidence: null },
    outcome: { status: state.status === 'finished' ? 'completed' : 'in_progress', winner: state.winner == null ? null : String(state.winner), reason: null },
    decisions: r.records.filter(row => row.telemetry).map(row => {
      const t = row.telemetry;
      return { decisionId: row.id, revisionBefore: row.revisionBefore, revisionAfter: row.revisionAfter, turn: t.turn, phase: t.phase, seat: String(t.seat),
        observationRef: `match.json#/battleDiagnostics/records/${r.records.indexOf(row)}/telemetry/observation`, pendingChoice: t.pendingChoice,
        legalActions: t.actions.map((x, i) => ({ id: `${row.id}:a${i}`, action: x.action })), candidateCoverage: 'generated_subset', totalLegalActions: null,
        candidates: t.actions.map((x, i) => ({ actionId: `${row.id}:a${i}`, evaluationStatus: x.score == null ? 'unavailable' : 'evaluated', score: x.score ?? null,
          unavailableReason: x.score == null ? (x.reason || 'Policy does not score this action') : null, reasonCodes: x.reason ? [x.reason] : [] })),
        chosenActionId: t.chosenIndex < 0 ? null : `${row.id}:a${t.chosenIndex}`, reasonCodes: [...(t.reasonCodes || []),...(t.depth==null?['actual_search_depth_unavailable']:[]),...(t.nodes==null?['actual_node_count_unavailable']:[])],
        search: { depth: t.depth ?? null, nodes: t.nodes ?? null, simulations: t.samples ?? null, elapsedMs: t.elapsedMs ?? null, budget: t.budget || {}, fallbackReason: t.fallbackReason || null },
        execution: { status: 'committed', errorCode: null, eventRef: `match.json#/battleDiagnostics/records/${r.records.indexOf(row)}` } };
    }) };
}
export function exportFiles(saved) {
  if (!saved?.state || saved.state.mode !== 'solo') throw Error('只可匯出本機離線對局；PvP 私人局面不會匯出。');
  if (!saved.battleDiagnostics) throw Error('此舊存檔未有 AI Review；完成一個動作後再匯出。');
  const review = reviewDocument(saved.battleDiagnostics, saved.state);
  reconstruct(saved.battleDiagnostics);
  const match = { schema: saved.schema, engine: saved.engine, savedAt: saved.savedAt, revision: saved.revision ?? saved.version,
    matchId: saved.matchId ?? saved.code, state: saved.state, reviewBuild: REVIEW_BUILD, battleDiagnostics: saved.battleDiagnostics };
  const files = { 'match.json': JSON.stringify(match), 'ai-review.json': JSON.stringify(review) };
  files['manifest.json'] = JSON.stringify({ schemaVersion: 'hololens.battle-export.v2', build: REVIEW_BUILD, matchId: review.matchId,
    files: Object.entries(files).map(([name, text]) => ({ name, integrity: stateHash(text), characters: text.length })), scope: 'offline_private' });
  files['README.txt'] = 'Offline private battle diagnostics. Includes both hands/decks. No automatic upload. Retained-state reconstruction only; see ai-review.json for limitations. Legacy schema-1 match envelope is retained. Historical unavailable fields are not fabricated.';
  return files;
}
