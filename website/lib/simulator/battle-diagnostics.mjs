// Offline diagnostic records are deliberately kept outside the game/policy state.
// No profile, transport token, device database or arbitrary directory is accepted.
export const REVIEW_BUILD = 'hololens-ai-review-v2-20260919';
// Match JSON persistence: absent object fields stay absent, array holes become
// null. In particular, never feed JSON.parse the non-string undefined result.
export const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function stable(value) {
  if (Array.isArray(value)) return '[' + Array.from(value,v => stable(v ?? null)).join(',') + ']';
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
      const had = Object.hasOwn(before, key) && before[key] !== undefined;
      const has = Object.hasOwn(after, key) && after[key] !== undefined;
      if (!has) { if (had) output.push({ path: [...path, key], remove: true }); }
      else if (!had) output.push({ path: [...path, key], value: clone(after[key]) });
      else difference(before[key], after[key], [...path, key], output);
    }
  } else output.push(after === undefined ? { path, remove: true } : { path, value: clone(after) });
  return output;
}
export function applyDifference(before, delta) {
  let result = clone(before);
  for (const change of delta) {
    if (change.path.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw Error('Unsafe diagnostic path');
    if (!change.path.length) { result = change.remove ? undefined : clone(change.value); continue; }
    let target = result;
    for (const key of change.path.slice(0, -1)) target = target[key];
    const key = change.path.at(-1);
    if (change.remove) delete target[key]; else target[key] = clone(change.value);
  }
  return result;
}
export function newRecording(state, revision, matchId, provenance, limits = {}) {
  const baseline = clone(state);
  return { schemaVersion: 'hololens.battle-diagnostics.v2', build: REVIEW_BUILD, matchId, provenance: clone(provenance),
    limits: { maxRecords: 2048, maxCharacters: 3 * 1024 * 1024, ...limits },
    initialState: baseline, baseline, baselineRevision: revision, baselineHash: stateHash(state),
    lastRevision: revision, droppedRecords: 0, droppedDecisions: 0, records: [], legacy: revision > 1,
    versions: [{ fromRevision: revision, provenance: clone(provenance) }] };
}
export function reviewBudget(t) {
  const measured = {};
  for (const key of ['invalidNodes','duplicateStates','defensiveNodes','exhaustedSamples','budgetExhausted','forced','cacheHit',
    'generatedCandidates','candidateMs','evaluationMs','simulationMs','evaluationCacheHits','evaluatedNodes','terminationReasons']) {
    if (t[key] !== undefined) measured[key] = t[key];
  }
  return { ...(t.budget || {}), ...(Object.keys(measured).length ? { measured } : {}) };
}
// Small historical decision summaries survive rotation of full state deltas.
// Keep the actual chosen action/score and measured search statistics, never
// invent discarded candidates or observations. This is separately bounded.
function decisionSummary(row) {
  const t = row.telemetry, chosen = t.actions?.[t.chosenIndex];
  return { id: row.id, revisionBefore: row.revisionBefore, revisionAfter: row.revisionAfter,
    telemetry: { turn: t.turn, phase: t.phase, seat: t.seat,
      observation: { available: false, reason: 'full_observation_rotated', hash: t.observation ? stateHash(t.observation) : null },
      pendingChoice: t.pendingChoice ? { type: t.pendingChoice.type, effect: t.pendingChoice.effect, playerIndex: t.pendingChoice.playerIndex } : null,
      actions: chosen ? [clone(chosen)] : [], chosenIndex: chosen ? 0 : -1,
      depth: t.depth ?? null, nodes: t.nodes ?? null, samples: t.samples ?? null, elapsedMs: t.elapsedMs ?? null,
      budget: clone(reviewBudget(t)), fallbackReason: t.fallbackReason || null,
      reasonCodes: [...(t.reasonCodes || []), 'compact_summary', 'candidate_details_not_retained'] } };
}
function trimSummaries(r) {
  const maxRecords = r.limits.maxDecisionSummaries ?? 1024;
  const maxCharacters = Math.min(r.limits.maxSummaryCharacters ?? 256 * 1024, Math.floor(r.limits.maxCharacters / 4));
  while (r.decisionSummaries?.length && (r.decisionSummaries.length > maxRecords || JSON.stringify(r.decisionSummaries).length > maxCharacters)) {
    r.decisionSummaries.shift(); r.droppedDecisionSummaries = (r.droppedDecisionSummaries || 0) + 1;
  }
}
/** @param {any} recording @param {any} before @param {any} after @param {number} revision @param {any} action @param {any} telemetry @param {any} entropy */
export function appendRecording(recording, before, after, revision, action, telemetry = null, entropy = null) {
  // Records are immutable once committed; copy only the spine, never the entire history.
  const r = { ...recording, records: [...recording.records], decisionSummaries: [...(recording.decisionSummaries || [])] };
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
    if (old.telemetry) { r.decisionSummaries.push(decisionSummary(old)); trimSummaries(r); }
  }
  // The baseline itself may exceed a caller's artificially small limit. State
  // reconstruction takes precedence; make that irreducible excess explicit.
  while (r.decisionSummaries.length && JSON.stringify(r).length > r.limits.maxCharacters) {
    r.decisionSummaries.shift(); r.droppedDecisionSummaries = (r.droppedDecisionSummaries || 0) + 1;
  }
  if (JSON.stringify(r).length > r.limits.maxCharacters) r.retentionLimitExceeded = 'baseline_and_initial_state';
  else delete r.retentionLimitExceeded;
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
  const entropyRows = r.records.filter(row => Array.isArray(row.entropy)).length;
  const entropyCapture = entropyRows === 0 ? 'none' : entropyRows === r.records.length ? 'complete' : 'partial';
  const summaries = r.decisionSummaries || [];
  const rows = [...summaries.map((row, i) => ({row, ref:`match.json#/battleDiagnostics/decisionSummaries/${i}`})),
    ...r.records.map((row, i) => ({row, ref:`match.json#/battleDiagnostics/records/${i}`}))];
  return { schemaVersion: 'hololens.ai-review.v1', synthetic: false, matchId: r.matchId, mode: 'offline_ai', provenance: r.provenance,
    capture: { complete: !r.legacy && !r.droppedRecords, droppedDecisions: r.droppedDecisions, retainedFromRevision: r.baselineRevision,
      notes: ['Generated candidate subsets are not exhaustive legal-action sets.', 'Policy rerun determinism is not claimed.',
        `Retained state range: revisions ${r.baselineRevision} through ${r.lastRevision}. Entropy capture describes this range only; export does not re-execute the engine.`,
        `Compact decision summaries retained: ${summaries.length}; full decision details dropped: ${r.droppedDecisions}; summary records dropped: ${r.droppedDecisionSummaries || 0}. Older missing decisions cannot be recovered.`,
        ...(r.retentionLimitExceeded ? ['The baseline and initial state alone exceed the configured diagnostic size limit.'] : []),
        ...((r.versions?.length||0)>1?['Runtime changed during resume; match.json records the version boundaries. Use each recorded version for engine replay.']:[]), ...(r.legacy ? ['Capture began after loading a legacy match; earlier decisions are unavailable.'] : [])] },
    visibility: { scope: 'offline_private', opponentHiddenIncluded: true, privilegedReplaySeparate: true },
    replay: { level: 'retained_states', entropyCapture, initialStateRef: 'match.json#/battleDiagnostics/baseline', actionLogRef: 'match.json#/battleDiagnostics/records', rngLogRef: entropyRows ? 'match.json#/battleDiagnostics/records' : null, verified: false, verificationEvidence: null },
    outcome: { status: state.status === 'finished' ? 'completed' : 'in_progress', winner: state.winner == null ? null : String(state.winner), reason: null },
    decisions: rows.filter(({row}) => row.telemetry).map(({row, ref}) => {
      const t = row.telemetry;
      return { decisionId: row.id, revisionBefore: row.revisionBefore, revisionAfter: row.revisionAfter, turn: t.turn, phase: t.phase, seat: String(t.seat),
        observationRef: `${ref}/telemetry/observation`, pendingChoice: t.pendingChoice,
        legalActions: t.actions.map((x, i) => ({ id: `${row.id}:a${i}`, action: x.action })), candidateCoverage: 'generated_subset', totalLegalActions: null,
        candidates: t.actions.map((x, i) => ({ actionId: `${row.id}:a${i}`, evaluationStatus: x.score == null ? 'unavailable' : 'evaluated', score: x.score ?? null,
          unavailableReason: x.score == null ? (x.reason || 'Policy does not score this action') : null, reasonCodes: x.reason ? [x.reason] : [] })),
        chosenActionId: t.chosenIndex < 0 ? null : `${row.id}:a${t.chosenIndex}`, reasonCodes: [...(t.reasonCodes || []),...(t.depth==null?['actual_search_depth_unavailable']:[]),...(t.nodes==null?['actual_node_count_unavailable']:[])],
        search: { depth: t.depth ?? null, nodes: t.nodes ?? null, simulations: t.samples ?? null, elapsedMs: t.elapsedMs ?? null, budget: reviewBudget(t), fallbackReason: t.fallbackReason || null },
        execution: { status: 'committed', errorCode: null, eventRef: ref } };
    }) };
}
export function exportFiles(saved) {
  if (!saved?.state || saved.state.mode !== 'solo') throw Error('只可匯出本機離線對局；PvP 私人局面不會匯出。');
  if (!saved.battleDiagnostics) throw Error('此舊存檔未有 AI Review；完成一個動作後再匯出。');
  const review = reviewDocument(saved.battleDiagnostics, saved.state);
  reconstruct(saved.battleDiagnostics);
  const match = { schema: saved.schema, engine: saved.engine, savedAt: saved.savedAt, revision: saved.revision ?? saved.version,
    matchId: saved.matchId ?? saved.code, state: saved.state, reviewBuild: REVIEW_BUILD, battleDiagnostics: saved.battleDiagnostics,
    ...(saved.aiPolicyPlan ? {aiPolicyPlan:saved.aiPolicyPlan} : {}) };
  const files = { 'match.json': JSON.stringify(match), 'ai-review.json': JSON.stringify(review) };
  files['manifest.json'] = JSON.stringify({ schemaVersion: 'hololens.battle-export.v2', build: REVIEW_BUILD, matchId: review.matchId,
    files: Object.entries(files).map(([name, text]) => ({ name, integrity: stateHash(text), characters: text.length })), scope: 'offline_private' });
  files['README.txt'] = 'Offline private battle diagnostics. Includes both hands/decks. No automatic upload. Retained-state reconstruction only; see ai-review.json for limitations. Legacy schema-1 match envelope is retained. Historical unavailable fields are not fabricated.';
  return files;
}
