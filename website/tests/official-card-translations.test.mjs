import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { officialCardTranslations, officialCardTranslation, officialCardTranslationReady, officialCardSourceFields } from '../lib/official-card-translations.mjs';
import { effectText, cardTagText } from '../lib/card-terminology.mjs';
import { cardSearchText, matchesSearch } from '../lib/catalog-search.mjs';
import { sourceTextSha256 } from '../scripts/validate-card-translations.mjs';

const catalogBytes = fs.readFileSync('public/cards.json'), cards = JSON.parse(catalogBytes).cards;
const byNumber = new Map(cards.map(card => [card.number, card]));
const numbers = Object.keys(officialCardTranslations.cards);

test('all 22 new cards have 91 exact guarded display fields and retain canonical Japanese/rules/printing identities', () => {
  assert.equal(numbers.length, 22); let fields = 0, effects = 0;
  for (const number of numbers) {
    const card = byNumber.get(number), before = JSON.stringify(card), entry = officialCardTranslations.cards[number];
    assert.equal(entry.sourceSha256, sourceTextSha256(card)); assert.equal(officialCardTranslationReady(card), true);
    assert.equal(entry.fields.length, officialCardSourceFields(card).length);
    for (const field of entry.fields) {
      assert.equal(officialCardTranslation(card, field.original, field.path), field.translation);
      assert.equal(effectText(card, field.original), field.translation);
      assert.equal(officialCardTranslation(card, `${field.original}\nCHANGED`, field.path), null);
      assert.doesNotMatch(field.translation, /[\u3040-\u30ff]/u); fields++;
      if (/\.effect$/.test(field.path) || ['abilityText','extra'].includes(field.path)) effects++;
    }
    const changed = structuredClone(card); changed.extra = `${changed.extra || ''}SOURCE REVISION`;
    assert.equal(officialCardTranslationReady(changed), false, 'a changed/missing source field invalidates complete-translation presentation');
    assert.equal(JSON.stringify(card), before); assert.equal(card.simulationStatus, 'not-audited');
  }
  assert.equal(fields, 91); assert.equal(effects, 32);
  assert.equal(fs.readFileSync('public/cards.json').equals(catalogBytes), true);
});

test('translated names, effects and tag labels are searchable with Japanese identity retained', () => {
  assert.equal(cardTagText('#アソビ★まわり隊！'), '#玩樂★巡遊隊！');
  for (const number of ['hSD20-001','hSD20-008','hSD21-001']) {
    const card = byNumber.get(number), text = cardSearchText(card);
    assert.ok(matchesSearch(text, effectText(card, card.name))); assert.ok(matchesSearch(text, card.jpName));
  }
  assert.ok(matchesSearch(cardSearchText(byNumber.get('hSD20-003')), '#玩樂★巡遊隊！'));
  assert.equal(officialCardTranslation(null, 'anything'), null);
  assert.equal(officialCardTranslation({ number:'hBP99-999' }, 'anything'), null);
});

test('actual card modal and simulator inspector show Chinese plus original Japanese without claiming playable effects', async t => {
  fs.mkdirSync('work', { recursive:true }); const outfile = `work/translated-display-${process.pid}.mjs`;
  await build({ stdin:{ contents:"export { CardModal } from './app/page'; export { CardInspector } from './app/simulator/SimulatorClient';", resolveDir:process.cwd(),loader:'tsx' },outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':process.cwd(),'next/link':'./firebase/Link.tsx'},define:{'import.meta.env':JSON.stringify({VITE_APP_BACKEND:'firebase'})},plugins:[{name:'private-display-test-export',setup(builder){builder.onLoad({filter:/(?:page|SimulatorClient)\.tsx$/},args=>({contents:fs.readFileSync(args.path,'utf8')+(args.path.endsWith('page.tsx')?'\nexport { CardModal };':'\nexport { CardInspector };'),loader:'tsx'}));}}] });
  t.after(()=>fs.unlinkSync(outfile)); const components=await import(new URL(`../${outfile}`,import.meta.url));
  for(const number of numbers){
    const card=byNumber.get(number), props={card,onClose(){},onAdd(){},onRemove(){},quantity:0,quantityForVariant:()=>0};
    const html=renderToStaticMarkup(createElement(components.CardModal,props))+renderToStaticMarkup(createElement(components.CardInspector,{card,cardMap:byNumber}));
    const dom=new JSDOM(html),body=dom.window.document.body;
    assert.match(body.querySelector('.effect-heading').textContent,/繁體中文翻譯/);assert.match(body.querySelector('.effect-heading').textContent,/AI.*未經人工覆核/);
    assert.equal(body.querySelectorAll('[data-card-import-warning]').length,2);assert.equal(body.querySelectorAll('[data-card-translation-note]').length,2);
    assert.match(body.querySelector('.sim-inspector-head .pending').textContent,/文字效果未支援.*人工/);assert.equal(body.querySelector('.sim-inspector-head .automated'),null);
    const sourceBlocks=[...body.querySelectorAll('.official-japanese-source')];assert.equal(sourceBlocks.length,2);
    for(const field of officialCardTranslations.cards[number].fields){assert.ok(body.textContent.includes(field.translation),`${number} translated ${field.path}`);for(const source of sourceBlocks)assert.ok(source.textContent.includes(field.original),`${number} original ${field.path}`);}
    dom.window.close();
  }
});
