// A pretend agent harness: ordinary code that sends the chain a prompt (the tools it may use and
// the user's question), watches what it writes back, and when that is a tool call in the agreed
// format ({"type":"tool_use",...}) runs the tool, appends the result and calls the chain again.
// The chain only predicts words; everything here is plain code.

// the tools the harness offers, as sent in the prompt
export const TOOLS = [{name: 'get_share_price', description: "Today's price for a stock ticker", input: {ticker: 'string'}}];

// [company, ticker, today's price from the FAKE api] (made up for the demo, not market data)
export const COMPANIES = [
  ['Tesco', 'TSCO.L', '412.3p'], ['Unilever', 'ULVR.L', '4512.0p'], ['Vodafone', 'VOD.L', '71.4p'],
  ['Shell', 'SHEL.L', '2689.5p'], ['BP', 'BP.L', '386.2p'], ['Diageo', 'DGE.L', '2344.8p'],
  ['Aviva', 'AV.L', '498.6p'], ['Barclays', 'BARC.L', '251.7p'],
];
const PRICES = Object.fromEntries(COMPANIES.map(([, ticker, price]) => [ticker, price]));

// the prompt's opening line: the tool list, the same in every training transcript
export const TOOLS_LINE = `tools: ${JSON.stringify(TOOLS)}`;

// the agreed formats (each one word, so the chain can predict it whole)
export const toolUse = (ticker) => JSON.stringify({type: 'tool_use', name: 'get_share_price', input: {ticker}});
export const toolResult = (content) => JSON.stringify({type: 'tool_result', content});

// a word the chain wrote -> the tool call it asks for, or null if it isn't one
export function parseToolUse(word) {
  try {
    const call = JSON.parse(word);
    return call?.type === 'tool_use' ? call : null;
  } catch {
    return null;
  }
}

// run a call with the fake api: {ok, content, message}
export function runTool({name, input}) {
  if (name !== 'get_share_price') return {ok: false, content: 'unknown_tool', message: `unknown tool "${name}": the harness only has get_share_price`};
  const price = PRICES[input?.ticker];
  return price
    ? {ok: true, content: price, message: `looked up ${input.ticker} in the fake price table: ${price}`}
    : {ok: false, content: 'unknown_ticker', message: `no fake price for "${input?.ticker}"`};
}

// the user's question as the chain's words: split on spaces, sentence punctuation dropped (as in training)
export const tokenise = (text) => text.split(/\s+/).map((w) => w.replace(/[?!.,]+$/, '')).filter(Boolean);

// one word, sampled by count from what followed the same context in the corpus
function sample(marcus, words) {
  const {options, total, context} = marcus.followers(words);
  let r = Math.random() * total;
  const {word} = options.find((o) => (r -= o.count) < 0) ?? {word: null};
  return {word, context};
}

// the chain writes until the corpus ended there (end_turn), it writes a tool call (tool_use: the
// harness takes over), or it runs out of words. [{word, context}], stop
function turn(marcus, words, maxWords) {
  const out = [];
  while (out.length < maxWords) {
    const next = sample(marcus, [...words, ...out.map((o) => o.word)]);
    if (next.word === null) return {out, stop: 'end_turn'};
    out.push(next);
    if (parseToolUse(next.word)) return {out, stop: 'tool_use'};
  }
  return {out, stop: 'max_tokens'};
}

/**
 * The whole exchange: harness -> chain (prompt), chain -> harness (a tool call, or not), harness
 * runs it, then the chain again with the result appended.
 * {prompt, first: {out, stop}, call?, result?, second?}
 */
export function converse(marcus, question, maxWords = 40) {
  const prompt = [...TOOLS_LINE.split(' '), 'user:', ...tokenise(question), 'assistant:'];
  const first = turn(marcus, prompt, maxWords);
  if (first.stop !== 'tool_use') return {prompt, first};
  const call = parseToolUse(first.out.at(-1).word);
  const result = runTool(call);
  const second = turn(marcus, [...prompt, ...first.out.map((o) => o.word), toolResult(result.content)], maxWords);
  return {prompt, first, call, result, second};
}
