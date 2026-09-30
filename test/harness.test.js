import {COMPANIES, converse, parseToolUse, runTool, tokenise, toolUse} from '../src/harness';
import {Markov} from '../src/markov';
import {shareCorpus} from '../scripts/make-share-prices.mjs';

test('a tool call is a word in the agreed JSON format; anything else is not', () => {
  expect(parseToolUse(toolUse('TSCO.L'))).toEqual({type: 'tool_use', name: 'get_share_price', input: {ticker: 'TSCO.L'}});
  expect(parseToolUse('{"type":"tool_result","content":"1p"}')).toBeNull();
  expect(parseToolUse('Tesco')).toBeNull();
  expect(parseToolUse('{"type":')).toBeNull(); // half a call
});

test('the fake api answers known tickers and fails unknown ones and unknown tools', () => {
  expect(runTool({name: 'get_share_price', input: {ticker: 'TSCO.L'}})).toMatchObject({ok: true, content: '412.3p'});
  expect(runTool({name: 'get_share_price', input: {ticker: 'XYZ.L'}})).toMatchObject({ok: false, content: 'unknown_ticker'});
  expect(runTool({name: 'sell', input: {}})).toMatchObject({ok: false, content: 'unknown_tool'});
});

test('questions are tokenised as in training: split on spaces, sentence punctuation dropped', () => {
  expect(tokenise("What's Tesco's share price today? ")).toEqual(["What's", "Tesco's", 'share', 'price', 'today']);
});

describe('the synthetic share-prices corpus', () => {
  const text = shareCorpus();
  const chain = (order) => {
    const m = new Markov(text);
    m.setOrder(order);
    m.buildChain();
    return m;
  };

  test('one transcript per line, and every price the fake api gives appears in training', () => {
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(COMPANIES.length * 60);
    expect(lines.every((l) => /^tools: .* user: .* assistant: \{"type":"tool_use".* assistant: .*\.$/.test(l))).toBe(true);
    expect(lines.some((l) => /[?!] /.test(l))).toBe(false); // the chain would split a line there
    for (const [, , price] of COMPANIES) expect(text).toContain(`"content":"${price}"`);
  });

  test('with 7 context words the chain calls the right ticker and repeats the api price', () => {
    for (const [company, ticker, price] of COMPANIES) {
      const {call, result, second} = converse(chain(7), `What is the share price of ${company}`);
      expect(call.input.ticker).toBe(ticker);
      expect(result.content).toBe(price);
      expect(second.out.map((o) => o.word)).toContain(price);
      expect(second.stop).toBe('end_turn');
    }
  });

  test('with 2 context words the chain sees only "today assistant:", so any ticker can follow', () => {
    const {options} = chain(2).followers(['user:', ...tokenise("What's Tesco's share price today?"), 'assistant:']);
    expect(options.map((o) => parseToolUse(o.word)?.input.ticker).filter(Boolean).length).toBeGreaterThan(1);
  });
});
