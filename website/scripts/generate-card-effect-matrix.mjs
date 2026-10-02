import { readFile, writeFile } from 'node:fs/promises';
import { splitAuditClauses } from './audit-clause-parser.mjs';

const root = new URL('../', import.meta.url);
const cardsUrl = new URL('public/cards.json', root);
const overridesUrl = new URL('docs/effect-audit/effect-audit-overrides.json', root);
const sharedRulesUrl = new URL('docs/effect-audit/shared-rule-audit.json', root);
const outputUrl = new URL('docs/effect-audit/CARD_EFFECT_MATRIX_CURRENT.json', root);
const catalog = JSON.parse(await readFile(cardsUrl, 'utf8'));
const overrides = JSON.parse(await readFile(overridesUrl, 'utf8'));
const sharedRuleAudit = JSON.parse(await readFile(sharedRulesUrl, 'utf8'));
const abilityFields = ['abilityText', 'keyword', 'stageSkill', 'oshiSkill', 'spOshiSkill', 'arts', 'extra'];
const rows = [];
const clauses = [];

function nonempty(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && typeof value === 'object';
}

for (const card of catalog.cards) {
  for (const field of abilityFields) {
    const value = card[field];
    if (!nonempty(value)) continue;
    const abilities = field === 'arts'
      ? value.map((spec, index) => ({ path: `arts.${index}`, spec }))
      : [{ path: field, spec: value }];
    for (const ability of abilities) {
      const key = `${card.number}:${ability.path}`;
      const proof = overrides[key] || {};
      const rawEffect = typeof ability.spec === 'string' ? ability.spec : ability.spec?.effect;
      const normalizedClauses = splitAuditClauses(rawEffect);
      rows.push({
        id: key,
        cardNumber: card.number,
        cardName: card.jpName || card.name,
        group: card.group,
        abilityType: ability.path.startsWith('arts.') ? 'arts' : field,
        path: ability.path,
        sourceLanguage: card.effectLanguage || 'unverified',
        textProvenance: card.effectLanguage === 'ja' && String(card.sourceUrl || '').startsWith('https://hololive-official-cardgame.com/')
          ? 'official-Japanese-catalog-snapshot; live text and applicable rulings still require verification'
          : 'catalog text is not an independently verified official Japanese rules source',
        officialJapaneseText: proof.officialJapaneseText || null,
        officialTextSources: proof.officialTextSources || [],
        expectedBehavior: proof.expectedBehavior || null,
        expectedBehaviorDefined: typeof proof.expectedBehavior === 'string' && proof.expectedBehavior.trim().length > 0,
        sourceSpec: ability.spec,
        clauses: normalizedClauses,
        variantIds: (card.variants || []).map(v => v.id),
        officialCardSources: [...new Set([card.sourceUrl, ...(card.variants || []).map(v => v.sourceUrl)].filter(Boolean))],
        status: proof.status || 'UNVERIFIED',
        officialRulingEvidence: proof.officialRulingEvidence || [],
        regressionEvidence: proof.regressionEvidence || [],
        runtimeEvidence: proof.runtimeEvidence || [],
        outstanding: proof.outstanding || ['Verify the Japanese text and current official rulings; add independent state-settlement cases; verify each supported production runtime.'],
      });
      clauses.push(...clausesFor(ability.spec, key, card, proof));
    }
  }
}

function clausesFor(spec, abilityId, card, proof = {}) {
  const raw = typeof spec === 'string' ? spec : spec?.effect;
  return splitAuditClauses(raw).map((text, index) => ({
    id: `${abilityId}#clause-${index + 1}`,
    abilityId,
    cardNumber: card.number,
    ordinal: index + 1,
    catalogText: text,
    textProvenance: card.effectLanguage === 'ja' && String(card.sourceUrl || '').startsWith('https://hololive-official-cardgame.com/')
      ? 'official-Japanese-catalog-snapshot; clause interpretation not independently reviewed'
      : 'catalog text; official Japanese clause and rule interpretation unverified',
    officialRuleSources: proof.officialRuleSources || [],
    testIds: proof.testIdsByClause?.[index + 1] || [],
    status: proof.clauseStatuses?.[index] || 'UNVERIFIED',
  }));
}

const abilityIdsByCard = new Map();
for (const row of rows) {
  const list = abilityIdsByCard.get(row.cardNumber) || [];
  list.push(row.id);
  abilityIdsByCard.set(row.cardNumber, list);
}
const cardChecks = catalog.cards.map(card => {
  const proof = overrides[`${card.number}:cardIdentity`] || {};
  return {
    cardNumber: card.number,
    cardName: card.jpName || card.name,
    group: card.group,
    variantIds: (card.variants || []).map(variant => variant.id),
    abilityIds: abilityIdsByCard.get(card.number) || [],
    hasPrintedRulesText: (abilityIdsByCard.get(card.number) || []).length > 0,
    identityStatus: proof.identityStatus || proof.status || 'UNVERIFIED',
    basicActionStatus: proof.basicActionStatus || 'UNVERIFIED',
    printingEquivalenceStatus: proof.printingEquivalenceStatus || 'UNVERIFIED',
    reason: proof.reason || (proof.status || proof.identityStatus
      ? 'Identity evidence is recorded for this card; ordinary-action and printing-equivalence status are tracked separately.'
      : 'Card identity, stats, ordinary actions, and printing-to-canonical mapping have not yet been independently checked for this run.'),
  };
});

rows.sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en') || a.path.localeCompare(b.path, 'en'));
const countsByStatus = items => Object.fromEntries([...new Set(items.map(item => item.status))].sort().map(status => [status, items.filter(item => item.status === status).length]));
const counts = countsByStatus(rows);
const matrix = {
  schemaVersion: 1,
  generatedOn: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  source: 'public/cards.json from the current website checkout; this is the audit denominator, not authority for expected rules behavior.',
  effectiveRulesBaseline: {
    version: '1.9.0',
    published: '2026-06-12',
    url: 'https://hololive-official-cardgame.com/wp-content/themes/tcg/assets/img/rule/whole_rule_ver190.pdf',
    cardSpecificRulingsOverrideOrClarify: true,
    documentContentHash: null,
    hashNote: 'Official source URL and version were inspected; this environment did not capture a byte-for-byte source PDF hash.',
  },
  officialCatalogReconciliation: {
    officialCardListResultCount: 2982,
    officialCardListUrl: 'https://hololive-official-cardgame.com/cardlist/?view=text',
    localCatalogRecordCount: catalog.cards.length,
    localPrintingVariantCount: catalog.cards.reduce((n, card) => n + (card.variants || []).length, 0),
    reconciled: false,
    note: 'Result counts use different possible grains and include records/products not reconciled to the local release scope. Resolve the exact missing and excluded records before declaring scope complete.',
  },
  currentCardCount: catalog.cards.length,
  printingCount: catalog.cards.reduce((n, card) => n + (card.variants || []).length, 0),
  abilityCount: rows.length,
  clauseCount: clauses.length,
  cardCheckCount: cardChecks.length,
  rowsByStatus: counts,
  clausesByStatus: countsByStatus(clauses),
  sharedRulesByStatus: countsByStatus(sharedRuleAudit.rules),
  cardsByStatus: countsByStatus(cardChecks.map(card => ({ status: card.identityStatus }))),
  basicActionByStatus: countsByStatus(cardChecks.map(card => ({ status: card.basicActionStatus }))),
  printingEquivalenceByStatus: countsByStatus(cardChecks.map(card => ({ status: card.printingEquivalenceStatus }))),
  complete: false,
  sharedRules: sharedRuleAudit.rules,
  cardChecks,
  rows,
  clauses,
};
await writeFile(outputUrl, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: outputUrl.pathname, currentCardCount: matrix.currentCardCount, printingCount: matrix.printingCount, abilityCount: matrix.abilityCount, clauseCount: matrix.clauseCount, cardCheckCount: matrix.cardCheckCount, rowsByStatus: counts, clausesByStatus: matrix.clausesByStatus, sharedRulesByStatus: matrix.sharedRulesByStatus, sharedRuleCount: matrix.sharedRules.length, cardsByStatus: matrix.cardsByStatus, complete: false }, null, 2));
