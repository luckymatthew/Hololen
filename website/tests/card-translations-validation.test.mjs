import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  assertTranslationArtifactMatchesSource, displayTextFields, sourceTextProjection,
  sourceTextSha256, validateCardTranslations, validateTranslationFiles,
} from '../scripts/validate-card-translations.mjs';

const sourceCard = {
  number: 'hSD99-001', jpName: '試験', name: '試験', group: 'holomem', officialImportSchema: 2,
  effectLanguage: 'ja', translationStatus: 'official-japanese-fallback', simulationStatus: 'not-audited',
  sourceUrl: 'https://hololive-official-cardgame.com/cardlist/?id=9000&view=text', tags: ['#新タグ'],
  extra: 'このホロメンはデッキに何枚でも入れられる',
  oshiSkill: { name: '出動！', effect: '相手1人に特殊ダメージ20を与える。', timing: 'Holo Power -3' },
  keyword: { name: '先へ進もう', effect: '自分のデッキを1枚引く。', type: 'gift' },
  arts: [{ name: '全力アタック', effect: '自分の手札が2枚なら、このアーツ+10。', damage: 20, cost: ['紅'] }],
  variants: [{ id: 'stable-printing-9000', image: 'https://hololive-official-cardgame.com/wp-content/images/cardlist/hSD99/hSD99-001_C.png' }],
};
const values = {
  name: '測試', extra: '這位成員可在牌組中放入任意張。',
  'oshiSkill.name': '出動！', 'oshiSkill.effect': '對對手1位成員造成特殊傷害20。', 'oshiSkill.timing': 'HOLO之力 -3',
  'keyword.name': '向前邁進', 'keyword.effect': '從自己的牌庫抽1張卡。',
  'arts.0.name': '全力攻擊', 'arts.0.effect': '若自己的手牌有2張，這個藝能傷害增加10。',
};
function fixture() {
  const card = structuredClone(sourceCard);
  const entry = {
    sourceUrl: card.sourceUrl, sourceLanguage: 'ja', displayLanguage: 'zh-Hant',
    translationStatus: 'ai-translated-from-official-japanese', humanReviewStatus: 'not-reviewed',
    engineSupportStatus: 'not-changed-by-translation', sourceSha256: sourceTextSha256(card),
    fields: displayTextFields(card).map(field => ({ ...field, translation: values[field.path] })),
  };
  return {
    catalog: { meta: {}, cards: [card] },
    bundles: [{ meta: { version: 'synthetic-translation-fixture', displayOnly: true, changesGameplay: false, translationStatus: 'ai-translated-from-official-japanese', cardCount: 1, fieldCount: 9, effectFieldCount: 4 }, tagDisplay: { '#新タグ': '#新標籤' }, cards: { [card.number]: entry } }],
  };
}
const entry = value => value.bundles[0].cards[sourceCard.number];
const check = value => validateCardTranslations(value);

test('source projection has a deterministic exact text-only hash while IDs, numbers and mechanics remain untouched', () => {
  assert.deepEqual(displayTextFields(sourceCard).map(field => field.path), ['name', 'extra', 'oshiSkill.name', 'oshiSkill.effect', 'oshiSkill.timing', 'keyword.name', 'keyword.effect', 'arts.0.name', 'arts.0.effect']);
  const projection = sourceTextProjection(sourceCard);
  assert.equal(projection.number, sourceCard.number); assert.equal(projection.jpName, sourceCard.jpName);
  assert.deepEqual(projection.tags, sourceCard.tags);
  assert.equal(sourceTextSha256(sourceCard).length, 64);
  assert.equal(sourceTextSha256({ ...sourceCard, hp: 999, id: 'other-canonical-id', variants: [] }), sourceTextSha256(sourceCard), 'display source proof is separate from preserved mechanical identity');
  assert.notEqual(sourceTextSha256({ ...sourceCard, jpName: '別名' }), sourceTextSha256(sourceCard));
  const value = fixture(), before = JSON.stringify(value);
  assert.equal(check(value).valid, true); assert.equal(JSON.stringify(value), before);
  assert.equal(value.catalog.cards[0].simulationStatus, 'not-audited');
});

test('new schema-2 translations need full exact-source coverage including every name, timing, rule field and tag', () => {
  const result = check(fixture());
  assert.equal(result.translatedCards, 1); assert.equal(result.translatedFields, 9); assert.equal(result.translatedEffectFields, 4); assert.equal(result.sourceHashedCards, 1);
  for (const field of displayTextFields(sourceCard)) {
    const value = fixture(); entry(value).fields = entry(value).fields.filter(item => item.path !== field.path);
    assert.throws(() => check(value), /required nonempty display field has no translation/, field.path);
  }
  const noTag = fixture(); delete noTag.bundles[0].tagDisplay['#新タグ'];
  assert.throws(() => check(noTag), /missing display translation for tag/);
});

for (const [name, mutate, pattern] of [
  ['missing card', value => { value.bundles[0].cards = {}; delete value.bundles[0].meta.cardCount; }, /cardCount|effectFieldCount|fieldCount|cannot ship without complete/],
  ['stale source hash', value => { entry(value).sourceSha256 = '0'.repeat(64); }, /sourceSha256/],
  ['missing source hash', value => { delete entry(value).sourceSha256; }, /sourceSha256/],
  ['changed Japanese source', value => { value.catalog.cards[0].keyword.effect += '更新'; }, /sourceSha256/],
  ['incorrect original field', value => { entry(value).fields[0].original = 'not the source'; }, /exact original Japanese source guard/],
  ['empty translation', value => { entry(value).fields[0].translation = ' '; }, /missing translation/],
  ['untranslated kana', value => { entry(value).fields[0].translation = '未翻訳かな'; }, /untranslated kana/],
  ['duplicate path', value => { entry(value).fields.push(structuredClone(entry(value).fields[0])); }, /duplicate\/invalid field path/],
  ['unknown path', value => { entry(value).fields[0].path = 'variants.0.id'; }, /exact original Japanese source guard/],
  ['lost numeric threshold', value => { entry(value).fields.find(field => field.path === 'arts.0.effect').translation = '這個藝能傷害增加10。'; }, /numeric counts\/thresholds changed/],
  ['changed count', value => { entry(value).fields.find(field => field.path === 'keyword.effect').translation = '從自己的牌庫抽2張卡。'; }, /numeric counts\/thresholds changed/],
  ['false engine support', value => { entry(value).engineSupportStatus = 'implemented'; }, /must not claim/],
  ['false human approval', value => { entry(value).humanReviewStatus = 'approved'; }, /must not claim/],
  ['false official approval', value => { entry(value).translationStatus = 'officially-approved'; }, /must not claim/],
  ['false bundle official approval', value => { value.bundles[0].meta.translationStatus = 'officially-approved'; }, /must not claim/],
  ['false bundle human approval', value => { value.bundles[0].meta.humanReviewStatus = 'approved'; }, /must not claim/],
  ['false bundle engine support', value => { value.bundles[0].meta.engineSupportStatus = 'implemented'; }, /must not claim/],
  ['gameplay bundle', value => { value.bundles[0].meta.changesGameplay = true; }, /explicitly not gameplay/],
  ['unversioned bundle', value => { delete value.bundles[0].meta.version; }, /versioned/],
  ['unknown official source', value => { entry(value).sourceUrl = 'https://example.invalid/cardlist/?id=9000'; }, /official source URL/],
  ['wrong official card source', value => { entry(value).sourceUrl = 'https://hololive-official-cardgame.com/cardlist/?id=9001'; }, /official source URL/],
  ['duplicate bundle', value => { value.bundles.push(structuredClone(value.bundles[0])); }, /duplicate translation card/],
  ['incorrect card count', value => { value.bundles[0].meta.cardCount++; }, /cardCount mismatch/],
  ['incorrect field count', value => { value.bundles[0].meta.fieldCount++; }, /fieldCount mismatch/],
  ['incorrect effect count', value => { value.bundles[0].meta.effectFieldCount++; }, /effectFieldCount mismatch/],
]) test(`publication gate rejects ${name}`, () => { const value = fixture(); mutate(value); assert.throws(() => check(value), pattern); });

test('an explicit refresh report also gates unflagged new Japanese cards instead of trusting importer flags', () => {
  const value = fixture(); delete value.catalog.cards[0].officialImportSchema; delete value.catalog.cards[0].effectLanguage; delete value.catalog.cards[0].translationStatus;
  value.requiredNumbers = [sourceCard.number];
  assert.equal(check(value).valid, true);
  value.bundles[0].cards = {}; value.bundles[0].meta.cardCount = 0; value.bundles[0].meta.fieldCount = 0; value.bundles[0].meta.effectFieldCount = 0;
  assert.throws(() => check(value), /cannot ship without complete translations/);
});

test('empty/no-op catalogs pass without inventing translations; unknown or duplicate card identities fail', () => {
  const empty = { meta: { version: 'synthetic-empty', displayOnly: true, changesGameplay: false, translationStatus: 'ai-translated-from-official-japanese' }, cards: {} };
  assert.equal(validateCardTranslations({ catalog: { cards: [] }, bundles: [empty] }).requiredCards, 0);
  assert.throws(() => validateCardTranslations({ catalog: { cards: [] }, bundles: [empty], requiredNumbers: ['hSD99-001'] }), /required card is absent/);
  const value = fixture(); value.catalog.cards.push(structuredClone(value.catalog.cards[0])); assert.throws(() => check(value), /duplicate canonical card numbers/);
});

test('the actual immutable hBP09 translation bundle covers111cards/464fields; eight Chinese-named effect-free Cheer records are explicitly exempt', () => {
  const raw = JSON.parse(fs.readFileSync('public/cards.json', 'utf8'));
  const bundleBytes = fs.readFileSync('public/hbp09-zh-Hant.json');
  assert.equal(createHash('sha256').update(bundleBytes).digest('hex'), '30433cb33c9376877ed7c56076e2ef598dc4d5e8d141ccf13464b13f70458a5a');
  const catalog = { ...raw, cards: raw.cards.filter(card => card.officialImportSchema !== 2) };
  const result = validateCardTranslations({ catalog, bundles: [JSON.parse(bundleBytes)] });
  assert.equal(result.legacyCards, 111); assert.equal(result.translatedFields, 464); assert.equal(result.translatedEffectFields, 169); assert.equal(result.exemptCheerCards, 8);
  const cheat = structuredClone(catalog); const cheer = cheat.cards.find(card => card.group === 'cheer' && card.effectLanguage === 'ja');
  cheer.extra = 'このカードは新しい効果を持つ。';
  assert.throws(() => validateCardTranslations({ catalog: cheat, bundles: [JSON.parse(bundleBytes)] }), /cannot ship without complete translations/);
});

test('CLI and artifact guard validate actual bytes and fail before any output is published', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hololen-translation-gate-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const value = fixture(), empty = { meta: { version: 'synthetic-empty', displayOnly: true, changesGameplay: false, translationStatus: 'ai-translated-from-official-japanese' }, cards: {} };
  const artifact = path.join(directory, 'built'); fs.mkdirSync(artifact);
  const files = { 'cards.json': value.catalog, 'hbp09-zh-Hant.json': empty, 'official-cards-zh-Hant.json': value.bundles[0] };
  for (const [name, payload] of Object.entries(files)) for (const dir of [directory, artifact]) fs.writeFileSync(path.join(dir, name), JSON.stringify(payload));
  assert.equal(validateTranslationFiles({ directory }).valid, true);
  assert.equal(assertTranslationArtifactMatchesSource({ sourceDirectory: directory, artifactDirectory: artifact }).valid, true);
  const script = path.resolve('scripts/validate-card-translations.mjs');
  const result = spawnSync(process.execPath, [script, `--directory=${directory}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).valid, true);
  fs.appendFileSync(path.join(artifact, 'official-cards-zh-Hant.json'), '\n');
  assert.throws(() => assertTranslationArtifactMatchesSource({ sourceDirectory: directory, artifactDirectory: artifact }), /does not match the tested source bytes/);
  fs.unlinkSync(path.join(directory, 'official-cards-zh-Hant.json'));
  const missing = spawnSync(process.execPath, [script, `--directory=${directory}`], { encoding: 'utf8' });
  assert.notEqual(missing.status, 0, 'missing translation bundle cannot become an empty successful deployment');
});

test('production build and Hosting guard both invoke the durable translation gate without changing importer draft semantics', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.build, /^npm run validate:translations && npm run validate:display-translations && vite build --config vite\.firebase\.config\.ts$/);
  assert.equal(pkg.scripts['validate:translations'], 'node scripts/validate-card-translations.mjs');
  assert.equal(pkg.scripts['validate:display-translations'], 'node scripts/embed-display-translations.mjs --check');
  const guard = fs.readFileSync('scripts/check-firebase-build.mjs', 'utf8');
  assert.match(guard, /assertTranslationArtifactMatchesSource\(\)/);
  const firebase = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  assert.deepEqual(firebase.hosting.predeploy, ['npm run build', 'node scripts/check-firebase-build.mjs']);
});
