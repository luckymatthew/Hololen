// Display/search vocabulary only. Never feed this output into rule evaluation.
// The library glossary is independent of the simulator's established vocabulary.
import { effectCorrections } from './effect-corrections.mjs';
import { hbp09Translation, hbp09TagText } from './hbp09-translations.mjs';
import { officialCardTranslation, officialCardTagText } from './official-card-translations.mjs';
export const terminologyVersion = '2026-09-05.2';
export const glossary = [
  ['ホロメン / Holomen', '成員'],
  ['推しホロメン', '主推成員'],
  ['推しスキル', '主推技能'],
  ['エール / Cheer', '能量'],
  ['サポート / Support', '支援卡'],
  ['アーツ / Arts', 'Arts'],
  ['ブルーム / Bloom', 'Bloom'],
  ['コラボ / Collab', 'Collab'],
  ['センター', '中央'],
  ['バック', '後備'],
  ['アーカイブ', '存檔區'],
  ['バトンタッチ', '接棒'],
  ['ホロパワー / Holo Power', 'Holo Power'],
];

const knownTags = ["#白上'sキャラクター", "#カエラ'sアームズ", "#FLOW GLOW", "#秘密結社holoX", "#Justice", "#ReGLOSS", "#Promise", "#Buzzグッズ", "#ホロウィッチ", "#DEV_IS", "#ハーフエルフ", "Buzzグッズ", "#Advent", "#シューター", "#ID3期生", "#ID2期生", "#ID1期生", "#ゲーマーズ", "#ベイビー", "#Myth", "#ケモミミ", "#こよラボ", "#きのこ", "#2期生", "#食べ物", "#サマー", "#1期生", "#4期生", "#3期生", "#0期生", "#5期生", "#料理", "#魔法", "#ID", "#獸耳", "#射手", "#語学", "#語言", "#トリ", "#EN", "#JP", "#食物", "きのこ", "#お酒", "#繪", "#鳥", "#絵", "#海", "#歌"];

const replacements = [
  [/推し\s*(?:ホロメン|Holomen|Holomem|Holo成員|成員)/gi, '主推成員'],
  [/推し\s*(?:技能|スキル)/g, '主推技能'],
  [/\bHolo\s*Power\b|ホロパワー|Holo能量(?:區)?/gi, 'HOLO之力'],
  [/\b(?:Holomen|Holomem)\b|Holo\s*成員|ホロメン|霍洛成員/gi, '成員'],
  [/吶喊卡/g, '聲援卡'],
  [/應援/g, '聲援'],
  [/\bCheer\b|エール|加油卡|加油/gi, '聲援'],
  [/\bFan\b|FAN/g, '粉絲'],
  [/\bCenter\b|中衛|中場|中置|中間位置/gi, '中央'],
  [/藝術傷害/g, '藝能傷害'],
  [/藝術卡|藝術牌|藝術值|藝能值|\bArts\s*值|アーツ/gi, '藝能'],
  [/藝術|\bArts\b/gi, '藝能'],
  [/綻放|\bBloom\b/gi, '開花'],
  [/合作|\bCollab\b/gi, '聯動'],
  [/中心/g, '中央'],
  [/後台|後排|後場/g, '後備'],
  [/檔案區域|檔案區|存檔區域/g, '存檔區'],
  [/歸檔/g, '存檔'],
  [/接力/g, '接棒'],
];

// Preserve quoted names, tags and identifiers, including nested card-name quotes.
function protectedSegments(value, names) {
  const pairs = { '〈': '〉', '《': '》', '「': '」', '『': '』', '“': '”' };
  const tokens = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  const result = [];
  let plain = '';
  for (let i = 0; i < value.length;) {
    const named = tokens.find(name => value.startsWith(name, i));
    const tag = knownTags.find(tag => value.startsWith(tag, i)) || value.slice(i).match(/^#[^\s，。；：、〈〉《》「」『』\[\]【】()（）]+/u)?.[0];
    if (named || tag) {
      if (plain) result.push([plain, false]);
      plain = '';
      const token = named || tag;
      result.push([token, true]); i += token.length; continue;
    }
    if (pairs[value[i]]) {
      if (plain) result.push([plain, false]);
      plain = '';
      const start = i; const stack = [pairs[value[i++]]];
      while (i < value.length && stack.length) {
        const ch = value[i++];
        if (ch === stack.at(-1)) stack.pop();
        else if (pairs[ch]) stack.push(pairs[ch]);
      }
      result.push([value.slice(start, i), true]); continue;
    }
    plain += value[i++];
  }
  if (plain) result.push([plain, false]);
  return result;
}

export function cardText(value, protectedNames = []) {
  return protectedSegments(String(value ?? ''), protectedNames).map(([text, protectedText]) =>
    protectedText ? text : normalizeTerms(text)
  ).join('');
}

function normalizeTerms(text) {
  return replacements.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

// The library uses the glossary's vocabulary; the simulator and legacy search aliases keep their existing terminology.
export function catalogCardText(value, protectedNames = []) {
  return protectedSegments(String(value ?? ''), protectedNames).map(([text, protectedText]) => protectedText ? text : normalizeTerms(text)
    .replace(/聲援/g, '能量')
    .replace(/藝能/g, 'Arts')
    .replace(/開花/g, 'Bloom')
    .replace(/聯動/g, 'Collab')
    .replace(/HOLO之力/g, 'Holo Power')
    .replace(/(\p{Script=Han})(?=Arts|Bloom|Collab|Holo Power)/gu, '$1 ')
    .replace(/(Arts|Bloom|Collab|Holo Power)(?=\p{Script=Han})/gu, '$1 ')
  ).join('');
}

export function keywordLabel(type) {
  return ({ bloom_effect: '開花效果（Bloom）', collab_effect: '聯動效果（Collab）', collab: '聯動效果（Collab）', bloom: '開花效果（Bloom）', gift: 'Gift 技能' })[type] || type || '技能';
}

export function catalogKeywordLabel(type) {
  if (type === 'bloom_effect' || type === 'bloom') return 'Bloom 效果';
  if (type === 'collab_effect' || type === 'collab') return 'Collab 效果';
  return keywordLabel(type);
}

function formatEffectText(card, value, format) {
  const skills = [card.keyword, card.stageSkill, card.oshiSkill, card.spOshiSkill, ...(card.arts || [])];
  // Exact original-text guard prevents an old review overwriting a newer card revision.
  const correction = (effectCorrections[card.number] || []).find(item => item.original === value);
  return format(officialCardTranslation(card, value) ?? hbp09Translation(card, value) ?? correction?.translation ?? value, [card.name, card.jpName, card.enName, ...skills.map(skill => skill?.name)]);
}

export function effectText(card, value) { return formatEffectText(card, value, cardText); }
export function catalogEffectText(card, value) { return formatEffectText(card, value, catalogCardText); }

// Display only: callers must retain the original tag in filters and game rules.
export function cardTagText(tag) { return officialCardTagText(tag) ?? hbp09TagText(tag); }
