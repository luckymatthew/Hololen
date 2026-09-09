import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cardText, effectText, keywordLabel } from '../lib/card-terminology.mjs';
import { cardSearchText, matchesSearch } from '../lib/catalog-search.mjs';

test('resource and location vocabulary is distinct', () => {
  assert.equal(cardText('吶喊卡、應援、支援卡、合作Holomen、後排Holomen、檔案區域'), '聲援卡、聲援、支援卡、聯動成員、後備成員、存檔區');
  assert.equal(keywordLabel('bloom_effect'), '開花效果（Bloom）');
  assert.equal(keywordLabel('collab_effect'), '聯動效果（Collab）');
});

test('quantities, optional costs, reveal/look and special damage are preserved', () => {
  const text = '可以將1～5張應援存檔：查看5張，公開其中1張支援卡。必須造成20點特殊傷害，這個Arts+30。';
  assert.equal(cardText(text), '可以將1～5張聲援存檔：查看5張，公開其中1張支援卡。必須造成20點特殊傷害，這個藝能+30。');
});

test('quoted names, nested names, tags and explicit skill names are immutable', () => {
  const text = '自己的〈應援合作〉、「Bloom Arts」、《「吶喊卡」的藝術》與#合作；合作Holomen';
  assert.equal(cardText(text), '自己的〈應援合作〉、「Bloom Arts」、《「吶喊卡」的藝術》與#合作；聯動成員');
  assert.equal(effectText({ name: '應援', arts: [{name: 'Bloom Arts'}] }, 'Bloom Arts 與應援'), 'Bloom Arts 與應援');
});

test('old and aligned terms both locate a card without conflating Support/Cheer', () => {
  const card = { number: 'test', abilityText: '可以將合作Holomen的應援放到檔案區域，這個Arts+20。', oshiSkill: {timing:'Holo Power -2',effect:'Holo Power'} };
  const index = cardSearchText(card);
  for (const query of ['合作 應援 Arts', '聯動 聲援 藝能', '存檔區', 'Holo Power', 'HOLO之力']) assert.ok(matchesSearch(index, query), query);
  assert.equal(matchesSearch(index, '支援卡'), false);
});

test('catalogue-wide display normalization is idempotent and leaves rule inputs untouched', () => {
  const cards = JSON.parse(fs.readFileSync(new URL('../public/cards.json', import.meta.url))).cards;
  for (const card of cards) {
    const before = JSON.stringify(card);
    const fields = [card.abilityText, card.extra, card.keyword?.effect, card.stageSkill?.effect, card.oshiSkill?.effect, card.spOshiSkill?.effect, ...card.arts.map(a => a.effect)].filter(Boolean);
    for (const text of fields) {
      const output = effectText(card, text);
      assert.equal(effectText(card, output), output, card.number);
      // Vocabulary-only normalization preserves numbers. Source-reviewed corrections
      // may restore omitted quantities, and have separate semantic regression tests.
      assert.deepEqual(cardText(text).match(/\d+/g), text.match(/\d+/g), card.number);
    }
    assert.equal(JSON.stringify(card), before);
  }
});
