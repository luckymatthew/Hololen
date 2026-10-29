import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const merger = fileURLToPath(new URL('../scripts/merge-official-card-refresh.mjs', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/official-card-refresh-v2.json', import.meta.url), 'utf8'));
const product = 'スタートデッキ アソビ★まわり隊！推し 熱千めら';
const byNumber = (catalog, number) => catalog.cards.find(card => card.number === number);
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
function input() { return { catalog: { meta: {}, cards: [] }, snapshot: structuredClone(fixture) }; }
function workspace(t, data = input()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'official-card-refresh-v2-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const catalogPath = path.join(directory, 'cards.json'), snapshotPath = path.join(directory, 'snapshot.json'), reportPath = path.join(directory, 'report.json');
  fs.writeFileSync(catalogPath, JSON.stringify(data.catalog)); fs.writeFileSync(snapshotPath, JSON.stringify(data.snapshot));
  return {
    catalogPath, snapshotPath, reportPath,
    run: () => spawnSync(process.execPath, [merger, snapshotPath, catalogPath, reportPath], { cwd: directory, encoding: 'utf8' }),
    catalog: () => JSON.parse(fs.readFileSync(catalogPath, 'utf8')),
    report: () => JSON.parse(fs.readFileSync(reportPath, 'utf8')),
    setSnapshot: snapshot => fs.writeFileSync(snapshotPath, JSON.stringify(snapshot)),
    setCatalog: catalog => fs.writeFileSync(catalogPath, JSON.stringify(catalog)),
  };
}
function successful(files) { const result = files.run(); assert.equal(result.status, 0, result.stderr || result.stdout); return files.catalog(); }

test('v2 imports official Oshi stage skills, costs, Holomem metadata, support and Cheer without inventing translations', t => {
  const files = workspace(t), catalog = successful(files);
  assert.equal(catalog.cards.length, 5);
  const oshi = byNumber(catalog, 'hSD21-001');
  assert.equal(oshi.id, '3043');
  assert.equal(oshi.group, 'oshi'); assert.equal(oshi.typeCode, 'oshiCharacter'); assert.equal(oshi.life, 5); assert.equal(oshi.maxCopies, 1);
  assert.equal(oshi.name, '熱千めら'); assert.equal(oshi.jpName, '熱千めら');
  assert.equal(oshi.nameTranslationStatus, 'official-japanese-fallback');
  assert.deepEqual(oshi.stageSkill, { name: 'サラマンダーの恩返し', effect: '自分のホロメンがコラボした時、自分のセンターが〈熱千めら〉なら、自分のデッキを1枚引き、手札1枚をアーカイブする。', timing: '' });
  assert.equal(oshi.oshiSkill.name, 'ご利益じゃ！'); assert.equal(oshi.oshiSkill.holoPower, 2); assert.equal(oshi.oshiSkill.holoPowerCost, 2);
  assert.equal(oshi.oshiSkill.timing, 'Holo Power -2'); assert.ok(!oshi.oshiSkill.effect.includes('[ホロパワー:'));
  assert.match(oshi.oshiSkill.effect, /^\[ターンに1回\]/); assert.equal(oshi.spOshiSkill, null);

  const debut = byNumber(catalog, 'hSD21-002');
  assert.equal(debut.group, 'holomem'); assert.equal(debut.typeCode, 'character'); assert.equal(debut.stage, 'Debut'); assert.equal(debut.hp, 120);
  assert.deepEqual(debut.colors, ['紫']); assert.deepEqual(debut.colorCodes, ['purple']); assert.equal(debut.baton, 1);
  assert.deepEqual(debut.tags, ['#アソビ★まわり隊！']); assert.equal(debut.keyword.type, 'gift'); assert.equal(debut.keyword.name, '防火対策 基礎！');
  assert.equal(debut.keyword.effect, 'このホロメンが受けるアーツダメージ-10。'); assert.equal(debut.unlimited, true); assert.equal(debut.maxCopies, 99);
  assert.equal(debut.extra, 'このホロメンはデッキに何枚でも入れられる');
  assert.deepEqual(debut.arts[0].cost, ['無色']); assert.equal(debut.arts[0].damage, 20);

  const second = byNumber(catalog, 'hSD21-007');
  assert.equal(second.stage, '2nd'); assert.equal(second.hp, 210); assert.equal(second.baton, 2); assert.equal(second.maxCopies, 4);
  assert.equal(second.arts[0].name, '「ご利益」担当'); assert.equal(second.arts[0].damage, 100); assert.equal(second.arts[0].damageModifier, '+');
  assert.deepEqual(second.arts[0].cost, ['紫', '無色']); assert.deepEqual(second.arts[0].specialTargets, ['黃']); assert.deepEqual(second.arts[0].specialValues, [50]);

  const support = byNumber(catalog, 'hSD21-008');
  assert.equal(support.group, 'support'); assert.equal(support.typeCode, 'supportTool'); assert.equal(support.maxCopies, 4);
  assert.equal(support.abilityText, fixture.printings.find(row => row.number === support.number).info['能力テキスト']);
  assert.deepEqual(support.arts, []);
  const cheer = byNumber(catalog, 'hY05-001');
  assert.equal(cheer.group, 'cheer'); assert.equal(cheer.typeCode, 'supportCheer'); assert.equal(cheer.maxCopies, 20);
  assert.deepEqual(cheer.colorCodes, ['purple']); assert.equal(cheer.name, '紫色應援');
  assert.equal(cheer.nameTranslationStatus, 'reviewed-mapping');
  for (const card of catalog.cards) {
    assert.equal(card.effectLanguage, 'ja'); assert.equal(card.translationStatus, 'official-japanese-fallback'); assert.equal(card.simulationStatus, 'not-audited');
    assert.equal(card.releaseDate, '2026-10-30'); assert.equal(card.preview, true); assert.equal(card.simOnly, false);
    assert.equal(card.variants.length, 1); assert.deepEqual(card.variants[0].sets, [product]); assert.match(card.variants[0].id, new RegExp(`^official-${card.number}-\\d+$`));
    assert.equal(card.sourceUrl, fixture.printings.find(row => row.number === card.number).sourceUrl);
  }
});

test('v2 is byte-idempotent; a repeated capture preserves stable card and printing IDs', t => {
  const files = workspace(t); successful(files);
  const once = fs.readFileSync(files.catalogPath, 'utf8'); successful(files);
  assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), once);
  assert.deepEqual(files.report().newCardNumbers, []);
});

test('v2 uses the source-verified release date, keeping Oct30 preview data separate from released data', t => {
  const data = input(); data.snapshot.capturedAt = '2026-10-30T00:00:00+00:00';
  const catalog = successful(workspace(t, data));
  assert.ok(catalog.cards.every(card => card.preview === false));
});

test('v2 reconciles every product additively and preserves existing translated rules and opaque IDs', t => {
  const files = workspace(t), baseline = successful(files), catalog = structuredClone(baseline);
  const card = byNumber(catalog, 'hSD21-007');
  card.id = 'opaque-saved-card-id'; card.name = '既有繁中卡名'; card.translationStatus = 'reviewed'; card.effectLanguage = 'zh-Hant'; card.simulationStatus = 'existing-audit-status';
  card.arts[0].name = '既有繁中藝能'; card.arts[0].effect = '既有繁中效果不應被官方日文覆寫';
  card.variants[0].id = 'opaque-saved-printing-id'; card.variants[0].sourceUrl = 'https://hololive-official-cardgame.com/cardlist/?id=3049';
  files.setCatalog(catalog);
  const snapshot = structuredClone(fixture), label = '回歸測試產品';
  const reprint = structuredClone(snapshot.printings.find(row => row.number === card.number));
  reprint.sourceUrl = 'https://hololive-official-cardgame.com/cardlist/?id=99999'; reprint.imageUrl = 'https://hololive-official-cardgame.com/wp-content/images/cardlist/hSD21/hSD21-007_test.png';
  reprint.info['収録商品'] = label; reprint.infoDetails['収録商品'].text = label;
  snapshot.printings.push(reprint); snapshot.totalResults = snapshot.printings.length;
  snapshot.products[label] = { releaseDate: '2026-10-11', sourceUrl: 'https://hololive-official-cardgame.com/products_detail/test/' };
  files.setSnapshot(snapshot);
  const merged = successful(files), updated = byNumber(merged, card.number);
  assert.deepEqual(without(updated, ['sets', 'variants']), without(card, ['sets', 'variants']));
  assert.deepEqual(updated.variants[0], card.variants[0]);
  assert.equal(updated.variants[1].id, `official-${card.number}-99999`); assert.deepEqual(updated.variants[1].sets, [label]);
  assert.deepEqual(updated.sets, [...card.sets, label]);
  assert.equal(merged.cards.length, 5); assert.equal(merged.meta.printings, 6);
});

const invalidCases = [
  ['incomplete page capture', ({ snapshot }) => { snapshot.successfulPages = 0; }],
  ['failed capture page', ({ snapshot }) => { snapshot.errors.push({ page: 1, error: 'test fixture capture failure' }); }],
  ['duplicate numbered image', ({ snapshot }) => { snapshot.printings.push(structuredClone(snapshot.printings[0])); }],
  ['untrusted image origin', ({ snapshot }) => { snapshot.printings[0].imageUrl = 'https://example.com/card.png'; }],
  ['missing stable official ID', ({ snapshot }) => { snapshot.printings[0].sourceUrl = 'https://hololive-official-cardgame.com/cardlist/'; }],
  ['untrusted official detail URL', ({ snapshot }) => { snapshot.printings[0].sourceUrl = 'https://example.com/cardlist/?id=3043'; }],
  ['unknown card type', ({ snapshot }) => { snapshot.printings[0].info['カードタイプ'] = '未知のカードタイプ'; }],
  ['missing required Holomem HP', ({ snapshot }) => { delete snapshot.printings[1].info.HP; delete snapshot.printings[1].infoDetails.HP; }],
  ['unknown color icon', ({ snapshot }) => { snapshot.printings[0].infoDetails['色'].images[0].src = '/wp-content/images/texticon/type_unknown.png'; }],
  ['missing support effect', ({ snapshot }) => { const row = snapshot.printings.find(row => row.number === 'hSD21-008'); row.info['能力テキスト'] = ''; row.infoDetails['能力テキスト'].text = ''; }],
  ['unverified product date', ({ snapshot }) => { delete snapshot.products[product].releaseDate; }],
  ['unknown effect field', ({ snapshot }) => { snapshot.printings[0].fields.push({ class: 'unknown ability', html: '<div class="unknown ability"><p>未知</p><p><span>未知</span>勝利する。</p></div>' }); }],
  ['missing Holo Power cost', ({ snapshot }) => { const field = snapshot.printings[0].fields.find(field => field.class === 'oshi skill'); field.html = field.html.replace('[ホロパワー:-2]', ''); }],
  ['conflicting new-card reprint metadata', ({ snapshot }) => {
    const row = structuredClone(snapshot.printings[1]); row.sourceUrl = 'https://hololive-official-cardgame.com/cardlist/?id=99998';
    row.imageUrl = 'https://hololive-official-cardgame.com/wp-content/images/cardlist/hSD21/hSD21-002_conflict.png'; row.info.HP = '999'; row.infoDetails.HP.text = '999';
    snapshot.printings.push(row); snapshot.totalResults = snapshot.printings.length;
  }],
];
for (const [name, invalidate] of invalidCases) {
  test(`v2 rejects ${name} without writing partial catalog or report`, t => {
    const data = input(); invalidate(data); const files = workspace(t, data), before = fs.readFileSync(files.catalogPath, 'utf8');
    const result = files.run(); assert.notEqual(result.status, 0, result.stdout);
    assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), before); assert.equal(fs.existsSync(files.reportPath), false);
  });
}

test('v2 refuses a disappearing official printing instead of deleting a saved-deck reference', t => {
  const files = workspace(t), baseline = successful(files), snapshot = structuredClone(fixture);
  snapshot.printings.pop(); snapshot.totalResults = snapshot.printings.length; files.setSnapshot(snapshot);
  const before = fs.readFileSync(files.catalogPath, 'utf8'), reportBefore = fs.readFileSync(files.reportPath, 'utf8'); const result = files.run();
  assert.notEqual(result.status, 0); assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), before);
  assert.equal(fs.readFileSync(files.reportPath, 'utf8'), reportBefore, 'a failed refresh must not replace the last successful report');
  assert.deepEqual(baseline, files.catalog());
});

test('v2 advances only importer-owned preview flags at release without claiming simulation support', t => {
  const files = workspace(t), catalog = successful(files), snapshot = structuredClone(fixture);
  const legacyPreview = byNumber(catalog, 'hSD21-002'); delete legacyPreview.officialImportSchema;
  files.setCatalog(catalog); snapshot.capturedAt = '2026-10-30T00:00:00+00:00'; files.setSnapshot(snapshot);
  const merged = successful(files);
  assert.equal(byNumber(merged, legacyPreview.number).preview, true, 'do not take ownership of legacy preview state');
  for (const card of merged.cards.filter(card => card.officialImportSchema === 2)) {
    assert.equal(card.preview, false); assert.equal(card.simulationStatus, 'not-audited');
  }
  assert.deepEqual(files.report().rollback.cardMetadata.filter(item => item.key === 'preview').map(item => item.number).sort(), ['hSD21-001', 'hSD21-007', 'hSD21-008', 'hY05-001']);
  const releasedLegacy = byNumber(merged, legacyPreview.number);
  assert.deepEqual(without(releasedLegacy, ['variants']), without(legacyPreview, ['variants']));
  assert.deepEqual(releasedLegacy.variants, legacyPreview.variants.map(variant => ({ ...variant, preview: false })), 'only importer-owned new printing lifecycle advances');
});

for (const [kind, typeCode] of [
  ['サポート・イベント・LIMITED', 'supportEventLimited'],
  ['サポート・アイテム・LIMITED', 'supportItemLimited'],
  ['サポート・スタッフ・LIMITED', 'supportStaffLimited'],
  ['サポート・マスコット', 'supportMascot'],
  ['サポート・ファン', 'supportFan'],
]) {
  test(`v2 maps ${kind} from official type metadata, not translated effect guesses`, t => {
    const data = input(), row = data.snapshot.printings.find(row => row.number === 'hSD21-008');
    row.info['カードタイプ'] = kind; row.infoDetails['カードタイプ'].text = kind;
    const card = byNumber(successful(workspace(t, data)), row.number);
    assert.equal(card.group, 'support'); assert.equal(card.typeCode, typeCode); assert.equal(card.maxCopies, 4); assert.equal(card.abilityText, row.info['能力テキスト']);
  });
}

test('v2 preserves an explicit X Holo Power cost instead of converting it to zero', t => {
  const data = input(), field = data.snapshot.printings[0].fields.find(field => field.class === 'oshi skill');
  field.html = field.html.replace('[ホロパワー:-2]', '[ホロパワー:-X]');
  const card = byNumber(successful(workspace(t, data)), 'hSD21-001');
  assert.equal(card.oshiSkill.holoPower, 'X'); assert.equal(card.oshiSkill.holoPowerCost, 'X'); assert.equal(card.oshiSkill.timing, 'Holo Power -X');
});

for (const [capturedAt, preview] of [['2026-10-29T14:59:59Z', true], ['2026-10-29T15:00:00Z', false]]) {
  test(`v2 respects Japan release midnight at ${capturedAt}`, t => {
    const data = input(); data.snapshot.capturedAt = capturedAt;
    const catalog = successful(workspace(t, data));
    assert.ok(catalog.cards.every(card => card.preview === preview));
    assert.ok(catalog.cards.every(card => card.variants.every(variant => variant.preview === preview)));
  });
}

test('v2 rejects an unknown malformed card row instead of hiding it as a teaching exclusion', t => {
  const data = input(); data.snapshot.printings[0].number = 'future-card-format';
  const files = workspace(t, data), before = fs.readFileSync(files.catalogPath, 'utf8');
  const result = files.run(); assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), before); assert.equal(fs.existsSync(files.reportPath), false);
});
