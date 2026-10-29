// Full, additive official-list reconciliation. Catalog data only; this never
// changes executable rule resolvers or marks a translation/effect audited.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://hololive-official-cardgame.com';
const IMAGE_PREFIX = `${ORIGIN}/wp-content/images/cardlist/`;
const NUMBER = /^[A-Za-z0-9]+-\d{3}$/;
const COLORS = { white: '白', green: '綠', red: '紅', blue: '藍', purple: '紫', yellow: '黃', null: '無色' };
const TYPES = {
  '推しホロメン': ['oshi', 'oshiCharacter', '推し Holomen'],
  'ホロメン': ['holomem', 'character', 'Holomen'],
  'Buzzホロメン': ['holomem', 'buzzCharacter', 'Buzz Holomen'],
  'エール': ['cheer', 'supportCheer', '應援'],
  'サポート・イベント': ['support', 'supportEvent', '事件'],
  'サポート・イベント・LIMITED': ['support', 'supportEventLimited', '事件・LIMITED'],
  'サポート・アイテム': ['support', 'supportItem', '道具'],
  'サポート・アイテム・LIMITED': ['support', 'supportItemLimited', '道具・LIMITED'],
  'サポート・ツール': ['support', 'supportTool', '工具'],
  'サポート・マスコット': ['support', 'supportMascot', '吉祥物'],
  'サポート・ファン': ['support', 'supportFan', '粉絲'],
  'サポート・スタッフ・LIMITED': ['support', 'supportStaffLimited', '工作人員・LIMITED'],
};
const RARITIES = ['OSR', 'RR', 'R', 'U', 'C', 'N', 'OC', 'P', 'S', 'SY', 'SR', 'UR', 'SEC', 'OUR', 'HR'];
const clean = value => String(value ?? '').replace(/[\t\r ]+/g, ' ').trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
const canonical = value => JSON.stringify(normalize(value));
const equal = (left, right) => canonical(left) === canonical(right);
const fail = message => { throw new Error(message); };
const unique = values => [...new Set(values)];
const number = value => /^\d+$/.test(clean(value)) ? Number(clean(value)) : null;
// Official product dates are Japanese calendar dates, not UTC dates.
const japaneseDate = capturedAt => new Date(Date.parse(capturedAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function officialUrl(value, label, prefix) {
  let url;
  try { url = new URL(value); } catch { fail(`Invalid official ${label}: ${value}`); }
  if (url.origin !== ORIGIN || url.username || url.password || (prefix && !url.pathname.startsWith(prefix))) {
    fail(`Invalid official ${label}: ${value}`);
  }
  return url;
}
function sourceId(row) {
  const url = officialUrl(row.sourceUrl, 'detail URL', '/cardlist/');
  const id = url.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) fail(`Missing stable official card-list id for ${row.number}`);
  return id;
}
function products(row) {
  const values = clean(row.info?.['収録商品']).split(/\n/).map(clean).filter(Boolean);
  if (!values.length) fail(`Missing official product for ${row.number}`);
  return unique(values);
}
function imageCode(image, prefix, row) {
  const source = typeof image === 'string' ? image : image.src;
  const url = officialUrl(new URL(source, ORIGIN).href, 'icon', '/wp-content/images/texticon/');
  const match = url.pathname.match(new RegExp(`/${prefix}_([a-z]+)\\.png$`));
  if (!match || !Object.hasOwn(COLORS, match[1])) fail(`Unrecognized ${prefix} color icon for ${row.number}: ${source}`);
  return match[1];
}
function text(node) {
  // textContent omits image alt text, as required for skill/art names.
  const clone = node.cloneNode(true);
  for (const br of clone.querySelectorAll('br')) br.replaceWith('\n');
  return clean(clone.textContent);
}

export function parseOfficialFields(row) {
  if (!Array.isArray(row.fields)) fail(`Missing official effect fields for ${row.number}`);
  const result = { extra: '', keyword: null, stageSkill: null, oshiSkill: null, spOshiSkill: null, arts: [] };
  const assigned = new Set();
  for (const field of row.fields) {
    if (!field.html) fail(`Missing official field HTML for ${row.number}`);
    const document = JSDOM.fragment(field.html);
    const div = document.firstElementChild;
    const ps = div && [...div.children].filter(node => node.tagName === 'P');
    if (!div || div.tagName !== 'DIV' || ps.length !== 2) fail(`Unexpected official field format for ${row.number}`);
    const classes = div.classList;
    const body = ps[1];
    const heading = [...body.children].find(node => node.tagName === 'SPAN');
    if (classes.contains('extra')) {
      if (assigned.has('extra')) fail(`Duplicate extra field for ${row.number}`);
      assigned.add('extra'); result.extra = text(body); continue;
    }
    if (!heading) fail(`Missing official field heading for ${row.number}`);
    const icons = [...heading.querySelectorAll('img')].map(img => img.getAttribute('src'));
    const special = heading.querySelector('.tokkou');
    const specialIcons = special ? [...special.querySelectorAll('img')].map(img => img.getAttribute('src')) : [];
    special?.remove();
    const title = text(heading);
    heading.remove();
    let effect = text(body);
    const power = effect.match(/\[ホロパワー:\s*[-−]([0-9]+|X)\]/);
    if (power) effect = effect.replace(power[0], '').trim();
    if (classes.contains('arts')) {
      const damage = title.match(/^(.*?)\s*(\d+)([+±\-−]*)$/u);
      if (!damage || !damage[1].trim()) fail(`Unparsed official Arts damage for ${row.number}: ${title}`);
      const cost = icons.filter(src => /\/arts_/.test(src)).map(src => COLORS[imageCode(src, 'arts', row)]);
      const specialTargets = [], specialValues = [];
      for (const src of specialIcons) {
        const url = officialUrl(new URL(src, ORIGIN).href, 'color bonus icon', '/wp-content/images/texticon/');
        const match = url.pathname.match(/\/tokkou_(\d+)_([a-z]+)\.png$/);
        if (!match || !COLORS[match[2]]) fail(`Unrecognized special damage icon for ${row.number}: ${src}`);
        specialTargets.push(COLORS[match[2]]); specialValues.push(Number(match[1]));
      }
      for (const src of icons) if (!/\/(?:arts_[a-z]+|tokkou_\d+_[a-z]+)\.png$/.test(src)) fail(`Unknown Arts icon for ${row.number}: ${src}`);
      result.arts.push({ name: damage[1].trim(), effect, damage: Number(damage[2]), damageModifier: damage[3], cost, specialTargets, specialValues });
    } else {
      let key, value;
      if (classes.contains('keyword')) {
        const kinds = icons.map(src => src.match(/\/(gift|bloom|collab)(?:EF)?\.png$/)?.[1]);
        if (kinds.length !== 1 || !kinds[0]) fail(`Unknown keyword icon for ${row.number}`);
        key = 'keyword'; value = { type: kinds[0], name: title, effect };
      } else if (classes.contains('skill')) {
        key = classes.contains('stage') ? 'stageSkill' : classes.contains('sp') ? 'spOshiSkill' : 'oshiSkill';
        value = { name: title, effect, timing: '' };
        if (key !== 'stageSkill') {
          if (!power) fail(`Missing Holo Power for ${row.number} ${key}`);
          const cost = /^\d+$/.test(power[1]) ? Number(power[1]) : power[1];
          Object.assign(value, { holoPower: cost, holoPowerCost: cost, timing: `Holo Power -${cost}` });
        }
      } else fail(`Unrecognized official effect field for ${row.number}: ${div.className}`);
      if (assigned.has(key)) fail(`Duplicate ${key} for ${row.number}`);
      if (!title || !effect) fail(`Empty ${key} name/effect for ${row.number}`);
      assigned.add(key); result[key] = value;
    }
  }
  return result;
}

function releaseForRow(row, snapshot) {
  const records = products(row).map(label => snapshot.products?.[label]).filter(Boolean);
  for (const record of records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.releaseDate || '')) fail(`Invalid verified release date for ${row.number}`);
    officialUrl(record.sourceUrl, 'product source URL');
  }
  const dates = records.map(record => record.releaseDate).sort();
  if (!dates.length && products(row).some(label => label !== 'PRカード')) {
    fail(`Missing verified product release date for new card ${row.number}`);
  }
  return dates[0] || null;
}

export function createOfficialCard(row, snapshot, names = {}) {
  const kind = row.info?.['カードタイプ'];
  const mapped = TYPES[kind];
  if (!mapped) fail(`No verified catalog mapping exists for new card ${row.number}: ${kind}`);
  const [group, typeCode, type] = mapped;
  const details = row.infoDetails || {};
  const colorIcons = details['色']?.images || [];
  const colorCodes = colorIcons.map(icon => imageCode(icon, 'type', row));
  if (['oshi', 'holomem', 'cheer'].includes(group) && !colorCodes.length) fail(`Missing official color icons for ${row.number}`);
  const abilities = parseOfficialFields(row);
  const abilityText = clean(row.info?.['能力テキスト']);
  const hp = number(row.info?.HP), life = number(row.info?.LIFE);
  const stage = clean(row.info?.['Bloomレベル']).replace(/ Buzz$/, '');
  if (group === 'holomem' && (hp == null || !['Debut', '1st', '2nd', 'Spot'].includes(stage) || !abilities.arts.length)) fail(`Missing Holomen stats for ${row.number}`);
  if (group === 'oshi' && (life == null || !abilities.oshiSkill)) fail(`Missing oshi stats for ${row.number}`);
  if (group === 'support' && !abilityText) fail(`Missing support effect for ${row.number}`);
  const batonIcons = details['バトンタッチ']?.images;
  if (batonIcons) for (const icon of batonIcons) imageCode(icon, 'arts', row);
  const releaseDate = releaseForRow(row, snapshot);
  const refreshDate = new Date(snapshot.capturedAt).toISOString().slice(0, 10);
  const unlimited = /何枚でも/.test(abilities.extra);
  const reviewed = Object.hasOwn(names, row.jpName);
  return {
    id: sourceId(row), number: row.number, name: reviewed ? names[row.jpName] : row.jpName,
    jpName: row.jpName, enName: '', group, type, typeCode,
    colors: colorCodes.map(color => COLORS[color]), colorCodes, stage,
    hp, life, rarity: row.info?.['レアリティ'] || '', set: products(row)[0], sets: products(row),
    tags: clean(row.info?.['タグ']).split(/\s+/).filter(Boolean), illustrator: clean(row.illustrator),
    baton: batonIcons ? batonIcons.length : null, image: row.imageUrl, variants: [],
    abilityText, ...abilities, qaCount: Number.isInteger(row.qaCount) ? row.qaCount : 0,
    maxCopies: group === 'oshi' ? 1 : group === 'cheer' ? 20 : unlimited ? 99 : 4,
    unlimited, restricted: false, preview: Boolean(releaseDate && releaseDate > japaneseDate(snapshot.capturedAt)), simOnly: false,
    ...(releaseDate ? { releaseDate } : {}), catalogVersion: `${refreshDate}-official-cardlist`,
    sourceUrl: row.sourceUrl, effectLanguage: 'ja', translationStatus: 'official-japanese-fallback',
    nameTranslationStatus: reviewed ? 'reviewed-mapping' : 'official-japanese-fallback', simulationStatus: 'not-audited', officialImportSchema: 2,
  };
}

export function reconcileOfficialCatalog(snapshot, input, names = {}) {
  if (snapshot.schemaVersion !== 2 || !Number.isInteger(snapshot.pages) || snapshot.pages < 1 || snapshot.successfulPages !== snapshot.pages || !Array.isArray(snapshot.errors) || snapshot.errors.length || !Array.isArray(snapshot.printings) || snapshot.totalResults !== snapshot.printings.length || !Number.isFinite(Date.parse(snapshot.capturedAt))) {
    fail('The official snapshot is incomplete; refusing to merge it.');
  }
  if (!Array.isArray(input.cards) || !input.meta) fail('Unexpected card catalog schema');
  const catalog = structuredClone(input);
  const rows = [], excludedRows = [], sourceIds = new Set(), officialKeys = new Set();
  for (const row of snapshot.printings) {
    if (!NUMBER.test(String(row.number || ''))) {
      // The official search includes one teaching/rules panel, not a playable card.
      if (row.number !== 'null' || row.jpName !== 'デッキ構築ルール' || sourceId(row) !== '2993' || sourceIds.has('2993')) fail(`Unexpected non-card listing row: ${row.number}`);
      sourceIds.add('2993');
      excludedRows.push({ number: row.number, jpName: row.jpName, sourceUrl: row.sourceUrl }); continue;
    }
    if (!row.jpName || !row.sourceUrl) fail(`Official record is missing its name or detail URL: ${row.number}`);
    const id = sourceId(row);
    if (sourceIds.has(id)) fail(`Duplicate official detail id: ${id}`);
    sourceIds.add(id);
    if (!String(row.imageUrl || '').startsWith(IMAGE_PREFIX)) fail(`Invalid official image reference for ${row.number}: ${row.imageUrl}`);
    officialUrl(row.imageUrl, 'image reference', '/wp-content/images/cardlist/');
    const key = `${row.number}|${row.imageUrl}`;
    if (officialKeys.has(key)) fail('Official snapshot has duplicate card-number/image pairs.');
    officialKeys.add(key); products(row); rows.push(row);
  }
  const byNumber = new Map(), cardIds = new Set(), variantIds = new Set();
  for (const card of catalog.cards) {
    if (byNumber.has(card.number)) fail(`Catalog has duplicate card number ${card.number}`);
    if (!card.id || cardIds.has(String(card.id))) fail(`Catalog has duplicate stable card id ${card.id}`);
    if (!Array.isArray(card.variants)) fail(`Missing variants for ${card.number}`);
    cardIds.add(String(card.id)); byNumber.set(card.number, card);
    const images = new Set();
    for (const variant of card.variants) {
      if (!variant.id || variantIds.has(String(variant.id))) fail(`Variant has a missing or duplicate stable id: ${variant.id}`);
      if (!variant.image || images.has(variant.image)) fail(`Variant has a missing or duplicate image for ${card.number}`);
      if (!officialKeys.has(`${card.number}|${variant.image}`)) fail(`Catalog image is absent from the captured official list: ${card.number}|${variant.image}`);
      images.add(variant.image); variantIds.add(String(variant.id));
    }
  }
  const grouped = Map.groupBy(rows, row => row.number);
  const addedVariants = [], newCards = [], printingMetadata = [], cardMetadata = [];
  const beforeCards = new Map(input.cards.map(card => [card.number, card]));
  const captureDate = japaneseDate(snapshot.capturedAt);
  const change = (obj, key, after, identity, records) => {
    if (equal(obj[key], after)) return;
    const record = { ...identity, key, had: Object.hasOwn(obj, key), ...(Object.hasOwn(obj, key) ? { before: structuredClone(obj[key]) } : {}), after: structuredClone(after) };
    obj[key] = after; records.push(record);
  };
  const productReport = {};
  for (const [cardNumber, printings] of grouped) {
    let card = byNumber.get(cardNumber);
    if (!card) {
      const sorted = [...printings].sort((a, b) => {
        const rank = row => RARITIES.indexOf(row.info?.['レアリティ']) < 0 ? 99 : RARITIES.indexOf(row.info['レアリティ']);
        return rank(a) - rank(b) || Number(sourceId(a)) - Number(sourceId(b));
      });
      card = createOfficialCard(sorted[0], snapshot, names);
      // Every alternate printing of a new card must agree on its playable data.
      const playable = item => Object.fromEntries(Object.entries(item).filter(([key]) => !['id', 'image', 'variants', 'rarity', 'set', 'sets', 'sourceUrl', 'releaseDate', 'preview', 'illustrator', 'qaCount'].includes(key)));
      for (const row of sorted.slice(1)) if (!equal(playable(card), playable(createOfficialCard(row, snapshot, names)))) fail(`Conflicting official reprint data for ${cardNumber}`);
      if (cardIds.has(String(card.id))) fail(`Official stable card id ${card.id} already belongs to another card`);
      cardIds.add(String(card.id)); byNumber.set(cardNumber, card); catalog.cards.push(card); newCards.push({ number: card.number, id: card.id });
    }
    for (const row of printings) {
      const labels = products(row);
      const matching = card.variants.find(variant => variant.image === row.imageUrl);
      if (matching) {
        if (matching.rarity !== (row.info?.['レアリティ'] || '')) fail(`Official rarity conflicts with stable printing ${cardNumber}/${matching.id}`);
        change(matching, 'sets', unique([...(matching.sets || []), ...labels]), { number: cardNumber, id: matching.id }, printingMetadata);
        if (!matching.sourceUrl) change(matching, 'sourceUrl', row.sourceUrl, { number: cardNumber, id: matching.id }, printingMetadata);
      } else {
        const id = `official-${cardNumber}-${sourceId(row)}`;
        if (variantIds.has(id)) fail(`Duplicate stable variant id ${id}`);
        const physicalProducts = labels.filter(label => label !== 'PRカード' && !label.startsWith('【使用可能カード】'));
        const printingReleaseDate = physicalProducts.map(label => snapshot.products?.[label]?.releaseDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')).sort()[0];
        const variant = { id, rarity: row.info?.['レアリティ'] || '', image: row.imageUrl, sets: labels, sourceUrl: row.sourceUrl, officialImportSchema: 2, ...(printingReleaseDate ? { releaseDate: printingReleaseDate, preview: printingReleaseDate > captureDate } : {}) };
        card.variants.push(variant); variantIds.add(id); addedVariants.push({ number: cardNumber, ...variant, products: labels });
      }
      const cardSets = unique([...(card.sets || []), ...labels]);
      // Record one aggregate change per card, not multiple intermediate states.
      card.sets = cardSets;
      for (const label of labels) {
        productReport[label] ||= { officialPrintings: 0, catalogPrintings: 0, addedPrintings: 0, ...(snapshot.products?.[label] || {}) };
        productReport[label].officialPrintings++;
        if (!matching) productReport[label].addedPrintings++;
      }
    }
  }
  for (const card of catalog.cards) {
    const old = beforeCards.get(card.number);
    for (const variant of card.variants) {
      if (variant.officialImportSchema === 2 && variant.preview === true && /^\d{4}-\d{2}-\d{2}$/.test(variant.releaseDate || '') && variant.releaseDate <= captureDate) {
        change(variant, 'preview', false, { number: card.number, id: variant.id }, printingMetadata);
      }
    }
    // Only this importer owns the release lifecycle of its newly created cards.
    // Never mutate legacy preview flags or claim effect implementation at release.
    if (old && card.officialImportSchema === 2 && card.preview === true && /^\d{4}-\d{2}-\d{2}$/.test(card.releaseDate || '') && card.releaseDate <= captureDate) {
      change(card, 'preview', false, { number: card.number }, cardMetadata);
    }
    if (old && !equal(old.sets, card.sets)) cardMetadata.push({ number: card.number, key: 'sets', had: Object.hasOwn(old, 'sets'), ...(Object.hasOwn(old, 'sets') ? { before: structuredClone(old.sets) } : {}), after: structuredClone(card.sets) });
  }
  const actualKeys = new Set(catalog.cards.flatMap(card => card.variants.map(variant => `${card.number}|${variant.image}`)));
  if (actualKeys.size !== officialKeys.size || [...officialKeys].some(key => !actualKeys.has(key))) fail('Catalog printings do not exactly match the official snapshot');
  for (const [label, report] of Object.entries(productReport)) {
    const expected = new Set(rows.filter(row => products(row).includes(label)).map(row => `${row.number}|${row.imageUrl}`));
    const actual = new Set(catalog.cards.flatMap(card => card.variants.filter(variant => variant.sets?.includes(label)).map(variant => `${card.number}|${variant.image}`)));
    report.catalogPrintings = actual.size;
    if (expected.size !== actual.size || [...expected].some(key => !actual.has(key))) fail(`Product variants do not exactly match the official ${label} list`);
  }
  catalog.cards.sort((left, right) => left.number.localeCompare(right.number, 'en', { numeric: true }));
  const refreshDate = new Date(snapshot.capturedAt).toISOString().slice(0, 10);
  Object.assign(catalog.meta, {
    generatedAt: snapshot.capturedAt, snapshotDate: refreshDate, catalogVersion: `${refreshDate}-official-cardlist`,
    uniqueCards: catalog.cards.length, sourceUniqueCards: grouped.size, printings: actualKeys.size,
    officialSourceUrl: `${ORIGIN}/cardlist/`, officialSourcePrintings: snapshot.printings.length,
    traditionalChineseCards: catalog.cards.filter(card => Object.hasOwn(names, card.jpName)).length,
    japaneseNameFallbackCards: catalog.cards.filter(card => !Object.hasOwn(names, card.jpName)).length,
  });
  const productsByDate = Object.entries(snapshot.products || {}).filter(([, item]) => /^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate || '')).sort((a, b) => a[1].releaseDate.localeCompare(b[1].releaseDate));
  const released = productsByDate.filter(([, item]) => item.releaseDate <= captureDate);
  const upcoming = productsByDate.filter(([, item]) => item.releaseDate > captureDate);
  const latestDate = released.at(-1)?.[1].releaseDate;
  if (latestDate && latestDate >= (catalog.meta.latestReleaseDate || '')) {
    const latest = released.filter(([, item]) => item.releaseDate === latestDate);
    catalog.meta.latestRelease = latest.map(([label]) => label).join(' / ') + `（${latestDate} 發售）`;
    catalog.meta.latestReleaseDate = latestDate;
    catalog.meta.latestReleasePrintings = latest.reduce((sum, [label]) => sum + (productReport[label]?.officialPrintings || 0), 0);
    delete catalog.meta.latestReleaseBaseCards;
    delete catalog.meta.latestReleaseParallels;
  }
  if (upcoming.length) {
    const upcomingDate = upcoming[0][1].releaseDate;
    catalog.meta.upcomingRelease = upcoming.filter(([, item]) => item.releaseDate === upcomingDate).map(([label]) => label).join(' / ') + `（${upcomingDate} 發售・先行公開）`;
    catalog.meta.upcomingReleaseDate = upcomingDate;
  } else if (catalog.meta.upcomingReleaseDate && catalog.meta.upcomingReleaseDate <= captureDate) {
    delete catalog.meta.upcomingRelease; delete catalog.meta.upcomingReleaseDate;
  }
  const report = {
    schemaVersion: 2, capturedAt: snapshot.capturedAt, catalogVersion: catalog.meta.catalogVersion,
    officialSource: { url: `${ORIGIN}/cardlist/`, pages: snapshot.pages, successfulPages: snapshot.successfulPages, listingRows: snapshot.printings.length, numberedPrintings: rows.length, uniqueCardNumbers: grouped.size, excludedRows },
    baselineCanonicalCatalogSha256: sha256(canonical(input)), resultCanonicalCatalogSha256: sha256(canonical(catalog)),
    products: productReport, newCardNumbers: newCards.map(card => card.number).sort(), newCards, addedVariants,
    removedVariants: [], rollback: { metaBefore: structuredClone(input.meta), originalCardOrder: input.cards.map(card => card.number), cardMetadata, printingMetadata, newCards, addedVariants },
    result: { cards: catalog.cards.length, printings: actualKeys.size, sourceUniqueCards: grouped.size, traditionalChineseCards: catalog.meta.traditionalChineseCards, japaneseNameFallbackCards: catalog.meta.japaneseNameFallbackCards },
    translationNote: 'Existing names, effects, stable card/printing IDs and simulation aliases are unchanged. New names reuse reviewed mappings only; new effects remain official Japanese with not-audited simulation status. No engine resolver is added.',
  };
  return { catalog, report };
}

export function runFullOfficialRefresh(snapshot, outputPath, reportPath) {
  const beforeBytes = fs.readFileSync(outputPath);
  const input = JSON.parse(beforeBytes);
  const names = JSON.parse(fs.readFileSync(new URL('./name-zh.json', import.meta.url), 'utf8'));
  const { catalog, report } = reconcileOfficialCatalog(snapshot, input, names);
  report.baselineCatalogSha256 = sha256(beforeBytes);
  const resultBytes = JSON.stringify(catalog);
  report.resultCatalogSha256 = sha256(resultBytes);
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  if (reportPath) fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
  // All validation occurs before either output is written.
  fs.writeFileSync(outputPath, resultBytes);
  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ capturedAt: report.capturedAt, catalogVersion: report.catalogVersion, addedCards: report.newCards.length, addedPrintings: report.addedVariants.length, result: report.result }, null, 2));
}
