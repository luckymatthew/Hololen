// Display/search data only. Canonical Japanese rules and engine support never change here.
import payload from '../public/official-cards-zh-Hant.json' with { type: 'json' };
export const officialCardTranslations = payload;
const at = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

export function officialCardSourceFields(card) {
  if (!card) return [];
  const fields = [['name', card.name], ['abilityText', card.abilityText], ['extra', card.extra]];
  for (const key of ['stageSkill', 'oshiSkill', 'spOshiSkill', 'keyword']) for (const part of ['name', 'effect', 'timing']) fields.push([`${key}.${part}`, card[key]?.[part]]);
  for (const [index, art] of (card.arts || []).entries()) for (const part of ['name', 'effect']) fields.push([`arts.${index}.${part}`, art[part]]);
  return fields.filter(([, value]) => typeof value === 'string' && value.trim()).map(([path, original]) => ({ path, original }));
}

export function officialCardTranslation(card, value, path) {
  const entry = payload.cards[card?.number];
  if (!entry || typeof value !== 'string') return null;
  const matches = entry.fields.filter(field => (!path || field.path === path) && field.original === value && at(card, field.path) === field.original && typeof field.translation === 'string' && field.translation.trim());
  return matches.length && matches.every(field => field.translation === matches[0].translation) ? matches[0].translation : null;
}

export function officialCardTranslationReady(card) {
  const entry = payload.cards[card?.number];
  if (!entry || entry.sourceLanguage !== 'ja' || entry.displayLanguage !== 'zh-Hant' || entry.translationStatus !== 'ai-translated-from-official-japanese' || entry.engineSupportStatus !== 'not-changed-by-translation') return false;
  const required = officialCardSourceFields(card);
  return required.length > 0 && required.every(({ path, original }) => entry.fields.filter(field => field.path === path).length === 1 && officialCardTranslation(card, original, path) !== null);
}

export function officialCardTagText(tag) { return payload.tagDisplay?.[tag] ?? null; }

export function officialSourceFieldLabel(path) {
  const labels = { name: '卡名', abilityText: '卡片效果', extra: 'Extra', stageSkill: '主推舞台技能', oshiSkill: '主推技能', spOshiSkill: 'SP 主推技能', keyword: '技能' };
  const parts = path.split('.');
  const suffix = { name: '名稱', effect: '效果', timing: '費用／時點' }[parts.at(-1)] || '';
  return parts[0] === 'arts' ? `藝能 ${Number(parts[1]) + 1}・${suffix}` : parts.length > 1 ? `${labels[parts[0]] || parts[0]}・${suffix}` : labels[path] || path;
}
