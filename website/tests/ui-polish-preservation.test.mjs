import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { polishAddedPaths, polishProvenance, restorePolishBaseline } from './ui-polish-preservation-helpers.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url));
const originalHashes = {
  'website/app/layout.tsx': '23f054385b1844ce91dd79d6cba3cb7482a519d38c838a04affa18fb5f3411b0',
  'website/firebase/main.tsx': '719bfc50eaa930bf17f3fad7f4fbd170c3e08849c15d3282f132d16a666634e1',
};

test('the added polish stylesheet matches its exact reviewed bytes', () => {
  const stylesheet = {
    path: 'website/app/polish.css',
    sha256: 'ed6579c8ed74aae5cb62a1610745e353d6af4b728e7487e8d267725b93229dfe',
  };
  assert.deepEqual(polishProvenance.addedFiles, [stylesheet]);
  assert.deepEqual(polishAddedPaths, [stylesheet.path]);
  assert.equal(hash(read(stylesheet.path)), stylesheet.sha256, 'The added stylesheet must match the independently pinned reviewed SHA-256');
});

test('polish changes exactly two entry imports after the existing design system', () => {
  assert.equal(polishProvenance.baselineSourceCommit, '9cfbeaa78252b9fdd479ad461db605348f07b24a');
  assert.deepEqual(polishProvenance.approvedPaths, Object.keys(originalHashes));
  assert.deepEqual(polishAddedPaths, ['website/app/polish.css']);
  const expectedPatches = [
    { before: 'import "./design-system.css";\n', after: 'import "./design-system.css";\nimport \'./polish.css\';\n' },
    { before: "import '../app/design-system.css';\n", after: "import '../app/design-system.css';\nimport '../app/polish.css';\n" },
  ];
  for (const [index, change] of polishProvenance.changes.entries()) {
    assert.equal(change.beforeSha256, originalHashes[change.path], `${change.path}: independently pinned original Git bytes`);
    assert.deepEqual(change.patches, [expectedPatches[index]], `${change.path}: only one adjacent CSS import is approved`);
    const current = read(change.path);
    assert.equal(hash(current), change.afterSha256, `${change.path}: current bytes must contain exactly the reviewed import`);
    const restored = restorePolishBaseline(change.path, current);
    assert.ok(Buffer.isBuffer(restored));
    assert.equal(hash(restored), originalHashes[change.path]);
    assert.equal(String(current), String(restored).replace(change.patches[0].before, change.patches[0].after));
  }
});

test('polish normalization composes idempotently without changing unrelated files', () => {
  for (const change of polishProvenance.changes) {
    const current = read(change.path);
    const restored = restorePolishBaseline(change.path, current);
    assert.strictEqual(restorePolishBaseline(change.path, restored), restored);
    assert.equal(restorePolishBaseline(change.path, String(current)), String(restored));
    assert.deepEqual(restorePolishBaseline(change.path.replace(/^website\//, './'), current), restored);
    assert.deepEqual(restorePolishBaseline(`C:\\workspace\\${change.path.replaceAll('/', '\\')}`, current), restored);
  }
  const unrelated = Buffer.from('unreviewed runtime change');
  for (const path of ['website/lib/simulator/engine.mjs', 'website/public/cards.json', 'website/app/design-system.css', 'website/firestore.rules']) {
    assert.strictEqual(restorePolishBaseline(path, unrelated), unrelated, `${path}: retain exact bytes for existing historical guards`);
  }
});

test('polish proof rejects extra runtime edits, duplicate imports and altered import order', () => {
  for (const change of polishProvenance.changes) {
    const current = String(read(change.path));
    const patch = change.patches[0];
    const added = patch.after.slice(patch.before.length);
    for (const [name, mutated] of [
      ['unrelated appended code', `${current}\nvoid 0;\n`],
      ['duplicate import', current.replace(patch.after, patch.after + added)],
      ['wrong order', current.replace(patch.after, added + patch.before)],
      ['different stylesheet', current.replace(added, added.replace('polish.css', 'other.css'))],
      ['CRLF byte rewrite', current.replaceAll('\n', '\r\n')],
    ]) assert.throws(() => restorePolishBaseline(change.path, mutated), /exact reviewed polish import bytes/, `${change.path}: ${name}`);
  }
});

test('historical redesign and production baseline fixture bytes remain frozen', () => {
  for (const [path, expected] of Object.entries({
    'website/tests/fixtures/ui-redesign-2026-10-29-runtime-changes.json': 'b461cba583920323f79cf5177dcecc8aeee7927217f7e360ad923c927a3f3b47',
    'website/tests/fixtures/card-refresh-production-baseline.json': '8d769262c6db3db1977025f6812286b770fdca0dc1b1be5e96c4a13f3f7c2b0a',
  })) assert.equal(hash(read(path)), expected, `${path}: no historical fixture refresh`);
});
