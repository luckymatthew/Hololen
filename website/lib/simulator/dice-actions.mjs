// Replay only the current action when a synchronous dice effect needs a choice.
// The baseline and random tape stay in private room state, never in a choice.
export const diceRuns = new WeakMap();
export class DicePause extends Error {
  constructor(state, choice) { super('dice choice'); this.state = state; this.choice = choice; }
}
export function diceDecision(state, choice) {
  const run = diceRuns.get(state);
  const index = run.decisionIndex++;
  if (index >= run.transaction.decisions.length) throw new DicePause(state, choice);
  const id = run.transaction.decisions[index];
  if (!choice.modeOptions.some(option => option.id === id)) throw new Error('骰子選擇已改變。');
  return id;
}
export function runDiceAction(input, playerIndex, action, cards, random, execute) {
  let transaction;
  if (input.pendingChoice?.effect === 'interactiveDice') {
    const choice = input.pendingChoice;
    if (action.type !== 'choose' || playerIndex !== choice.playerIndex || !choice.modeOptions.some(option => option.id === action.optionId)) throw new Error('骰子選擇無效。');
    if (!input.privateDiceAction) throw new Error('骰子結算資料不存在。');
    transaction = structuredClone(input.privateDiceAction);
    transaction.decisions.push(action.optionId);
  } else transaction = { baseline: input, playerIndex, action, random: [], decisions: [] };
  let randomIndex = 0;
  const tapedRandom = () => {
    if (randomIndex === transaction.random.length) transaction.random.push(random());
    return transaction.random[randomIndex++];
  };
  const run = { transaction, decisionIndex: 0, context: transaction.baseline.pendingChoice || transaction.action };
  try { return execute(transaction.baseline, transaction.playerIndex, transaction.action, cards, tapedRandom, run); }
  catch (error) {
    if (!(error instanceof DicePause)) throw error;
    error.state.pendingChoice = error.choice;
    error.state.privateDiceAction = structuredClone(transaction);
    return error.state;
  }
}
