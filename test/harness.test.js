import {applyHarness, isToolCall, parseToolCall, runTool} from '../src/harness';
import {clean} from '../src/textprep';
import {Markov} from '../src/markov';
import {shareCorpus} from '../scripts/make-share-prices.mjs';

test('tool tokens are "$" then a letter, parsed into tool and argument', () => {
  expect(parseToolCall('$price-tsco')).toEqual({tool: 'price', argument: 'tsco'});
  expect(parseToolCall('$SELL-BP')).toEqual({tool: 'sell', argument: 'bp'});
  expect(parseToolCall('$launch')).toEqual({tool: 'launch', argument: ''});
  expect(isToolCall('$45')).toBe(false); // money, not a tool
  expect(parseToolCall('price')).toBeNull();
  expect(parseToolCall('sha$l')).toBeNull(); // a "$" inside a word (tiny-shakespeare has one)
});

test('the fake registry answers known calls and fails unknown ones', () => {
  expect(runTool({tool: 'price', argument: 'tsco'})).toMatchObject({ok: true, result: '101'});
  expect(runTool({tool: 'price', argument: 'xyz'})).toMatchObject({ok: false, result: 'ERROR'});
  expect(runTool({tool: 'launch', argument: 'missiles'})).toMatchObject({ok: false, message: 'unknown tool "launch": nothing in the registry'});
});

test('the sell tool is refused unless permitted', () => {
  expect(runTool({tool: 'sell', argument: 'tsco'})).toMatchObject({ok: false, result: 'REFUSED'});
  expect(runTool({tool: 'sell', argument: 'tsco'}, {allowSell: false}).message).toMatch(/^refused/);
  expect(runTool({tool: 'sell', argument: 'tsco'}, {allowSell: true})).toMatchObject({ok: true, result: '101'});
});

test('the harness runs tool tokens and fills the NUMs after them', () => {
  const out = applyHarness('NUM then $price-bp result NUM at NUM'.split(' '));
  expect(out.map((t) => t.kind)).toEqual(['unfilled', 'word', 'call', 'word', 'filled', 'word', 'filled']);
  expect(out.map((t) => t.word).join(' ')).toBe('NUM then $price-bp result 404 at 404'); // no call yet: NUM stays
  expect(applyHarness(['$sell-bp', 'NUM'])[1].word).toBe('REFUSED');
});

describe('the synthetic share-prices corpus', () => {
  const text = shareCorpus();

  test('tool tokens survive cleaning and chain building', () => {
    const cleaned = clean(text);
    expect(cleaned.split('\n').sort()).toEqual(text.trim().split('\n').sort()); // cleaning changes nothing
    expect(cleaned).toContain('$price-tsco');
    const m = new Markov(cleaned);
    m.setOrder(3);
    m.buildChain();
    expect(m.followers(['sell', 'my', 'tesco', 'shares']).options.map((o) => o.word)).toContain('$sell-tsco');
  });

  test('at low order the chain can call the wrong ticker; at high order it follows the company', () => {
    const next = (order) => {
      const m = new Markov(text);
      m.setOrder(order);
      m.buildChain();
      return m.followers('what is the tesco share price'.split(' ')).options.map((o) => o.word);
    };
    const low = next(1); // sees only "price"
    expect(low).toContain('$price-tsco');
    expect(low.filter((w) => w.startsWith('$price-') && w !== '$price-tsco').length).toBeGreaterThanOrEqual(7);
    expect(next(6)).toEqual(['$price-tsco']); // sees "what is the tesco share price"
  });
});
