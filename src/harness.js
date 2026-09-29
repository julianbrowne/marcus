// A pretend agent harness: ordinary code that watches the chain's words and, when one is a tool
// token ($tool-argument, e.g. $price-tsco), runs a matching function and puts its result into the
// NUM placeholders that follow. The chain only predicts words; everything here is plain code.

// FAKE prices in pence, made up for the demo (not market data)
const FAKE_PRICES = {tsco: 101, sbry: 202, barc: 303, bp: 404, ulvr: 505, vod: 606, lloy: 707, shel: 808};

// the fake tool registry: name -> (argument, permissions) -> {ok, result, message}
const TOOLS = {
  price: (ticker) => (ticker in FAKE_PRICES
    ? {ok: true, result: String(FAKE_PRICES[ticker]), message: `looked up ${ticker} in a hard-coded table of fake prices: ${FAKE_PRICES[ticker]}p`}
    : {ok: false, result: 'ERROR', message: `no fake price for "${ticker}"`}),
  sell: (ticker, {allowSell}) => {
    if (!allowSell) return {ok: false, result: 'REFUSED', message: 'refused: the sell tool is not permitted (permission is off)'};
    if (!(ticker in FAKE_PRICES)) return {ok: false, result: 'ERROR', message: `no fake holding in "${ticker}"`};
    return {ok: true, result: String(FAKE_PRICES[ticker]), message: `pretended to sell ${ticker} at a fake ${FAKE_PRICES[ticker]}p (nothing was sold)`};
  },
};

// "$" then a letter: "$price-tsco" is a tool token, "$45" (money) is not
export const isToolCall = (word) => /^\$[a-z]/i.test(word);

// "$price-tsco" -> {tool: 'price', argument: 'tsco'}; null if the word isn't a tool token
export function parseToolCall(word) {
  if (!isToolCall(word)) return null;
  const [tool, ...rest] = word.slice(1).toLowerCase().split('-');
  return {tool, argument: rest.join('-')};
}

// run a parsed call against the registry. {ok, result, message}
export function runTool({tool, argument}, permissions = {allowSell: false}) {
  const fn = TOOLS[tool];
  if (!fn) return {ok: false, result: 'ERROR', message: `unknown tool "${tool}": nothing in the registry`};
  return fn(argument, permissions);
}

/**
 * Run a list of words through the harness: each tool token is intercepted and run, and later
 * NUM placeholders take the latest result; a NUM with no call before it stays unfilled.
 * [{word, kind: 'word' | 'call' | 'filled' | 'unfilled', call?}]
 */
export function applyHarness(words, permissions) {
  let latest = null;
  return words.map((word) => {
    const parsed = parseToolCall(word);
    if (parsed) {
      latest = {token: word, ...parsed, ...runTool(parsed, permissions)};
      return {word, kind: 'call', call: latest};
    }
    if (word === 'NUM') return latest ? {word: latest.result, kind: 'filled'} : {word, kind: 'unfilled'};
    return {word, kind: 'word'};
  });
}
