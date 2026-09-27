const CLOSE_FOR_OPEN = new Map([
  ['「', '」'], ['『', '』'], ['（', '）'], ['【', '】'], ['《', '》'], ['〈', '〉'],
  ['[', ']'], ['(', ')'], ['{', '}'], ['"', '"'], ['“', '”'], ['‘', '’'],
]);
const JAPANESE_TERMINALS = new Set(['。', '！', '？']);
const ASCII_TERMINALS = new Set(['.', '!', '?']);

function isSentenceEnd(text, index, char) {
  if (JAPANESE_TERMINALS.has(char)) return true;
  if (!ASCII_TERMINALS.has(char)) return false;
  const next = text[index + 1];
  const previous = text[index - 1];
  if (char === '.' && /\d/u.test(previous || '') && /\d/u.test(next || '')) return false;
  return index + 1 >= text.length || /\s/u.test(next);
}

export function splitAuditClauses(value) {
  const text = String(value || '');
  const clauses = [];
  const quoteStack = [];
  let start = 0;

  const push = end => {
    const clause = text.slice(start, end).trim();
    if (clause) clauses.push(clause);
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoteStack.at(-1) === char) {
      quoteStack.pop();
      continue;
    }
    if (quoteStack.length) {
      const nestedClose = CLOSE_FOR_OPEN.get(char);
      if (nestedClose && nestedClose !== char) quoteStack.push(nestedClose);
      continue;
    }
    const closing = CLOSE_FOR_OPEN.get(char);
    if (closing) {
      quoteStack.push(closing);
      continue;
    }
    if (char === '\r' || char === '\n') {
      push(index);
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      start = index + 1;
      continue;
    }
    if (!isSentenceEnd(text, index, char)) continue;
    push(index + 1);
    start = index + 1;
  }
  push(text.length);
  return clauses;
}
