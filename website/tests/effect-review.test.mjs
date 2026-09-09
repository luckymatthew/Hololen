import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { effectText } from '../lib/card-terminology.mjs';
import { effectCorrections, effectAuditSummary } from '../lib/effect-corrections.mjs';
import { cardSearchText, matchesSearch } from '../lib/catalog-search.mjs';

const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url)));
const list = Array.isArray(cards) ? cards : cards.cards;
const card = number => list.find(c => c.number === number);
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

test('seat fan requirement is positive, not inverted', () => {
  const c = card('hBP01-070');
  assert.match(effectText(c, c.arts[0].effect), /必須附有〈座員〉/);
});
test('optional cost, 2nd level and Cheer destination remain distinct', () => {
  const c = card('hSD03-009');
  assert.match(effectText(c, c.arts[1].effect), /^可以/);
  const d = card('hSD08-007');
  assert.match(effectText(d, d.keyword.effect), /2nd成員/);
  const e = card('hSD13-013');
  const text = effectText(e, e.keyword.effect);
  assert.match(text, /附加到此成員/);
  assert.doesNotMatch(text, /抽1張|直接疊放/);
});
test('archive cost direction and dice arithmetic match reviewed meaning', () => {
  const c = card('hBP02-002');
  assert.match(effectText(c, c.oshiSkill.effect), /所附加的1張綠色聲援卡送入存檔區/);
  const d = card('hBP01-043');
  assert.match(effectText(d, d.arts[0].effect), /點數總和乘以10/);
});
test('all corrections have source and exact current-text guards without mutating rules', () => {
  const before = JSON.stringify(list);
  for (const [number, entries] of Object.entries(effectCorrections)) {
    const c = card(number);
    assert.ok(c, number);
    for (const entry of entries) {
      assert.equal(get(c, entry.path), entry.original, `${number} ${entry.path}`);
      assert.match(entry.sourceUrl, /^https:\/\/hololive-official-cardgame\.com\/cardlist\//);
      assert.ok(effectText(c, entry.original));
    }
  }
  assert.equal(JSON.stringify(list), before);
  const c = card('hBP01-070');
  assert.equal(effectText(c, '新版效果文字'), '新版效果文字');
  assert.ok(effectAuditSummary.completeCards > 0 && effectAuditSummary.completeCards < list.length);
  assert.ok(effectAuditSummary.unreviewedEffects > 0);
});
test('corrected effects are searchable and same text on other cards is not replaced', () => {
  const c = card('hSD13-013');
  assert.ok(matchesSearch(cardSearchText(c), '附加到此成員'));
  const original = card('hBP01-070').arts[0].effect;
  assert.doesNotMatch(effectText({number:'unknown', arts:[]}, original), /必須附有/);
});

 test('life prevention, this-card condition and once-per-turn cap are restored', () => {
  const life = card('hBP05-001'); assert.match(effectText(life, life.spOshiSkill.effect), /本次失去的生命（LIFE）減少1/);
  const target = card('hBP06-021'); assert.match(effectText(target, target.keyword.effect), /若此卡附有/);
  const stage = card('hBP07-004'); assert.match(effectText(stage, stage.stageSkill.effect), /^\[每回合1次\]/);
  assert.equal(card('hBP01-005').oshiSkill.timing, 'Holo Power -X');
  assert.equal(card('hBP02-033').arts[0].damage, 80);
 });
