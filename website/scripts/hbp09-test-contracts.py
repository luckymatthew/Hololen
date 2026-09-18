"""Update only assertions superseded by actual executable hBP09 integration.
The 155 prior Oshi cost distribution, activation counts and 112 prior supports
remain mandatory. No tests are skipped and no expected previous behavior is removed.
"""
from pathlib import Path

def change(text,old,new):
    if new in text:return text
    if text.count(old)!=1:raise ValueError('Regression-test source drift: '+old[:100])
    return text.replace(old,new,1)

def patch_tests(root):
    path=root/'tests/oshi-skill-regression.test.mjs';text=path.read_text(encoding='utf-8')
    text=change(text,'card.group === "oshi" && !CATALOG_ONLY_OSHI.includes(card.number)','card.group === "oshi" && !card.number.startsWith("hBP09-")')
    start='test("all seven hBP09 Oshi preserve official metadata without exposing unimplemented activations", () => {'
    end='test("every active non-Birthday Oshi skill has an engine resolver branch", () => {'
    replacement='''test("all seven hBP09 Oshi preserve official costs and expose implemented activation windows", () => {
  const incoming = cards.filter((card) => card.group === "oshi" && card.number.startsWith("hBP09-"));
  assert.equal(incoming.length, 7);
  assert.equal(cards.filter((card) => card.group === "oshi").length, 162);
  assert.deepEqual(CATALOG_ONLY_OSHI, []);
  assert.deepEqual(incoming.map(c => c.number).sort(), Array.from({length: 7}, (_,i) => `hBP09-${String(i+1).padStart(3,'0')}`));
  for (const card of incoming) {
    const enriched = enrichOshiCardMetadata(card);
    assert.equal(enriched.number, card.number);
    assert.equal(enriched.oshiSkill.name, card.oshiSkill.name);
    assert.equal(enriched.oshiSkill.effect, card.oshiSkill.effect);
    assert.equal(oshiSkillPowerCost(card.number, 'oshi'), card.oshiSkill.holoPowerCost);
    assert.match(enriched.oshiSkill.timing, new RegExp(`Holo Power -${card.oshiSkill.holoPowerCost}`));
    assert.equal(isReactiveOshiSkill(card.number), card.number === 'hBP09-005');
    assert.equal(isActivatableOshiSkill(card.number), card.number !== 'hBP09-005');
    assert.equal(isActivatableOshiSkill(card.number, 'sp'), card.number === 'hBP09-006');
    if (card.spOshiSkill) assert.equal(oshiSkillPowerCost(card.number, 'sp'), card.spOshiSkill.holoPowerCost);
  }
  // Actual costs, state mutations and invalid actions are independently exercised
  // through applyAction in hbp09-executable.test.mjs, not inferred from this table.
});

'''
    if start in text:
        if text.count(start)!=1 or text.count(end)!=1:raise ValueError('Ambiguous Oshi test boundary')
        a=text.index(start);b=text.index(end,a);text=text[:a]+replacement+text[b:]
    elif replacement not in text:raise ValueError('Unexpected hBP09 Oshi contract test')
    for name in ['resolveNormalOshiSkill','resolveSpOshiSkill','activateOshiSkill']:
        old=f'engineSource.indexOf("function {name}")'
        new=f'engineSource.indexOf("function hbp09Legacy_{name}")'
        text=change(text,old,new)
    old='  const oshiCards = cards.filter((card) => card.group === "oshi");'
    new='  const oshiCards = cards.filter((card) => card.group === "oshi" && !card.number.startsWith("hBP09-"));\n  const newPrograms = readFileSync(new URL("../lib/simulator/hbp09/programs.mjs", import.meta.url), "utf8");\n  for (const key of ["001:oshi", "002:oshi", "003:oshi", "004:oshi", "006:oshi", "006:sp", "007:oshi"]) assert.ok(newPrograms.includes(key), `${key} executable program missing`);'
    text=change(text,old,new)
    result={path:text}
    path=root/'tests/simulator-effect-catalog.test.mjs';text=path.read_text(encoding='utf-8')
    text=change(text,'  assert.equal(AUTOMATED_SUPPORT_CARDS.length, 112);', '''  assert.equal(AUTOMATED_SUPPORT_CARDS.filter(n => !n.startsWith('hBP09-')).length, 112);
  assert.deepEqual(AUTOMATED_SUPPORT_CARDS.filter(n => n.startsWith('hBP09-')).sort(), Array.from({length:16},(_,i)=>`hBP09-${String(90+i).padStart(3,'0')}`));
  assert.equal(AUTOMATED_SUPPORT_CARDS.length, 128);''')
    result[path]=text
    return result
