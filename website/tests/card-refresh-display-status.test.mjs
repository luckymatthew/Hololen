import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import test from 'node:test';
import { CATALOG_ONLY_OSHI, isActivatableOshiSkill, enrichOshiCardMetadata, oshiSkillPowerCost } from '../lib/simulator/oshi-skill-catalog.mjs';
import { hash } from './card-refresh-test-helpers.mjs';
import { restoreUiBaseline } from './ui-preservation-helpers.mjs';

const catalog = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(readFileSync(new URL('./fixtures/card-refresh-2026-10-29-baseline.json', import.meta.url), 'utf8'));
const approved = JSON.parse(readFileSync(new URL('./fixtures/card-refresh-2026-10-29-runtime-changes.json', import.meta.url), 'utf8'));
const cardMap = new Map(catalog.cards.map(card => [card.number, card]));
const approvedByPath = new Map(approved.changes.map(change => [change.path.replace(/^website\//, ''), change]));
function originalSource(file, change) {
  let contents = restoreUiBaseline(change.path, readFileSync(file, 'utf8'));
  assert.equal(hash(contents), change.afterSha256, `${change.path}: exact reviewed warning patch`);
  for (const patch of [...change.patches].reverse()) {
    assert.equal(contents.split(patch.after).length - 1, 1, `${change.path}: unambiguous reversible patch`);
    contents = contents.replace(patch.after, patch.before);
  }
  assert.equal(hash(contents), change.beforeSha256, `${change.path}: restore exact previous source`);
  return contents;
}

test('only five approved warning/registry/footer paths differ; reversing patches preserves their exact prior bytes', () => {
  assert.equal(approved.baselineSourceCommit, baseline.sourceCommit);
  assert.deepEqual([...approved.approvedPaths].sort(), ['website/app/globals.css', 'website/app/page.tsx', 'website/app/simulator/SimulatorClient.tsx', 'website/firebase/main.tsx', 'website/lib/simulator/oshi-skill-catalog.mjs']);
  for (const change of approved.changes) originalSource(change.path.replace(/^website\//, ''), change);
  const registry = approvedByPath.get('lib/simulator/oshi-skill-catalog.mjs');
  assert.equal(registry.patches.length, 1);
  assert.equal(registry.patches[0].before, 'export const CATALOG_ONLY_OSHI = Object.freeze([]); // hBP09 resolvers installed');
  assert.equal(registry.patches[0].after, 'export const CATALOG_ONLY_OSHI = Object.freeze(["hSD20-001", "hSD21-001"]); // Official data only; no engine resolvers.');
});

test('new Oshi retain official metadata but cannot activate either normal/SP unsupported resolver', () => {
  assert.deepEqual(CATALOG_ONLY_OSHI, ['hSD20-001', 'hSD21-001']);
  for (const number of CATALOG_ONLY_OSHI) {
    const card = cardMap.get(number); assert.ok(card); assert.equal(card.officialImportSchema, 2);
    assert.equal(enrichOshiCardMetadata(card), card, 'do not replace official parsed costs or stage skills with guessed metadata');
    assert.equal(isActivatableOshiSkill(number, 'oshi'), false); assert.equal(isActivatableOshiSkill(number, 'sp'), false);
    assert.equal(oshiSkillPowerCost(number, 'oshi'), null); assert.equal(oshiSkillPowerCost(number, 'sp'), null);
    assert.equal(card.oshiSkill.holoPowerCost, number === 'hSD20-001' ? 3 : 2); assert.ok(card.stageSkill.effect);
  }
});

test('rendered card modal/inspector warnings and existing1394 presentation remain deterministic', async t => {
  mkdirSync('work', { recursive: true });
  const bundles = [];
  async function bundle(prior) {
    const outfile = `work/card-refresh-display-${prior ? 'baseline' : 'current'}-${process.pid}.mjs`; bundles.push(outfile);
    await build({
      stdin: { contents: `export { CardModal } from './app/page'; export { CardInspector, OshiPosition, automationLabel } from './app/simulator/SimulatorClient';`, resolveDir: process.cwd(), loader: 'tsx' },
      outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', alias: { 'next/link': './firebase/Link.tsx' },
      define: { 'import.meta.env': JSON.stringify({ VITE_APP_BACKEND: 'firebase' }) },
      plugins: [{ name: 'inspect-private-card-refresh-display', setup(builder) {
        builder.onLoad({ filter: /(?:page|SimulatorClient)\.tsx$/ }, args => {
          const relative = path.relative(process.cwd(), args.path), change = approvedByPath.get(relative);
          if (!change) return;
          const source = prior ? originalSource(args.path, change) : readFileSync(args.path, 'utf8');
          const exports = relative === 'app/page.tsx' ? '\nexport { CardModal };' : '\nexport { CardInspector, OshiPosition, automationLabel };';
          return { contents: source + exports, loader: 'tsx' };
        });
        if (prior) builder.onLoad({ filter: /oshi-skill-catalog\.mjs$/ }, args => ({ contents: originalSource(args.path, approvedByPath.get('lib/simulator/oshi-skill-catalog.mjs')), loader: 'js' }));
      } }],
    });
    return import(new URL(`../${outfile}`, import.meta.url));
  }
  t.after(() => { for (const file of bundles) unlinkSync(file); });
  const prior = await bundle(true), current = await bundle(false);
  const modalProps = { onClose() {}, onAdd() {}, onRemove() {}, quantity: 0, quantityForVariant: () => 0 };
  const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
  await t.test('every original card keeps exact modal content/controls and byte-identical inspector/automation output', () => {
    for (const number of baseline.cardOrder) {
      const originalCard = cardMap.get(number); assert.ok(originalCard, number);
      const originalIds = new Set(baseline.printingOrder[number]);
      const card = { ...originalCard, variants: originalCard.variants.filter(variant => originalIds.has(variant.id)) };
      const previousCardMap = new Map(cardMap); previousCardMap.set(number, card);
      const normalizeModal = html => html.replace('class="studio-card-dialog t-modal"', 'class="studio-card-dialog"').replace(/ aria-pressed="(?:true|false)"/g, '');
      assert.equal(normalizeModal(render(current.CardModal, { card, ...modalProps })), normalizeModal(render(prior.CardModal, { card, ...modalProps })), `${number}: every text, image, stat, rule, quantity control and printing preserved (only documented motion/focus semantics differ)`);
      assert.equal(render(current.CardInspector, { card, cardMap: previousCardMap }), render(prior.CardInspector, { card, cardMap: previousCardMap }), `${number}: existing simulator inspector`);
      assert.equal(current.automationLabel(card), prior.automationLabel(card), `${number}: existing automation status`);
    }
  });
  await t.test('new22 cards show Japanese fallback and pending/manual warnings, never automatic labels', () => {
    const incoming = catalog.cards.filter(card => card.officialImportSchema === 2);
    assert.equal(incoming.length, 22);
    for (const card of incoming) {
      const dom = new JSDOM(render(current.CardModal, { card, ...modalProps }) + render(current.CardInspector, { card, cardMap }));
      const body = dom.window.document.body;
      assert.match(body.querySelector('.effect-heading').textContent, /官方日文效果/);
      assert.ok(body.querySelectorAll('[data-card-import-warning]').length === 2);
      assert.match(body.querySelector('.sim-inspector-head .pending').textContent, /文字效果未支援・需人工處理/);
      assert.equal(body.querySelector('.sim-inspector-head .automated'), null);
      assert.ok(!body.querySelector('.effect-heading').textContent.includes('繁體中文效果'));
      assert.match(body.querySelector('.preview-badge').textContent, /官方先行公開/);
      for (const skill of [card.stageSkill, card.oshiSkill, card.spOshiSkill, card.keyword, ...card.arts].filter(Boolean)) {
        if (skill.effect) assert.ok(body.textContent.includes(skill.effect), `${card.number}: literal official Japanese effect remains visible`);
      }
      if (card.arts.some(art => art.damageModifier === '+')) {
        for (const art of card.arts.filter(art => art.damageModifier === '+')) {
          assert.ok(body.querySelector('.card-modal').textContent.includes(`${art.damage}+`), `${card.number}: printed plus in modal`);
          assert.ok(body.querySelector('.sim-card-inspector').textContent.includes(`${art.damage}+`), `${card.number}: printed plus in inspector`);
        }
      }
      if (card.abilityText) assert.ok(body.textContent.includes(card.abilityText), `${card.number}: literal Japanese support text remains visible`);
      dom.window.close();
    }
  });
  await t.test('old hSD14-010 keeps old card state while its new Oct30 printing shows a preview badge and date', () => {
    const card = cardMap.get('hSD14-010'), variant = card.variants.find(variant => variant.id === 'official-hSD14-010-3042');
    assert.equal(card.preview, false); assert.equal(variant.officialImportSchema, 2); assert.equal(variant.preview, true);
    const dom = new JSDOM(render(current.CardModal, { card, ...modalProps, initialVariantId: variant.id }) + render(current.CardInspector, { card, cardMap, variantId: variant.id }));
    const body = dom.window.document.body;
    assert.match(body.querySelector('.preview-badge').textContent, /官方先行公開/);
    assert.ok(body.querySelector('.variant-strip .active').textContent.includes('官方先行公開'));
    assert.ok(body.querySelector('.card-modal').textContent.includes('2026-10-30'));
    assert.ok(body.querySelector('.sim-card-inspector').textContent.includes('官方先行公開・2026-10-30'));
    dom.window.close();
  });
  await t.test('new Oshi have no desktop or mobile activation action; existing Oshi action output is unchanged', () => {
    for (const card of catalog.cards.filter(card => card.group === 'oshi')) {
      const player = { oshi: { id: `oshi-${card.number}`, number: card.number }, zones: {}, holoPowerCount: 10, name: 'Fixture' };
      const props = { player, cardMap, canActivate: true, turn: 3 };
      const actual = render(current.OshiPosition, props);
      if (CATALOG_ONLY_OSHI.includes(card.number)) {
        const dom = new JSDOM(actual); assert.equal(dom.window.document.querySelector('.sim-oshi-skill'), null);
        assert.equal(dom.window.document.querySelector('.sim-mobile-oshi-actions'), null); dom.window.close();
      } else assert.equal(actual, render(prior.OshiPosition, props), `${card.number}: existing activation UI`);
    }
  });
});
