import {Markov} from './markov';

function build(corpus, order = 1, minWords = 1) {
  const m = new Markov(corpus);
  m.setOrder(order);
  m.setMinWords(minWords);
  m.buildChain();
  return m;
}

const sample = (m, n = 300) => Array.from({length: n}, () => m.sentence());

test('generated sentences only use words that followed the same context in the corpus', () => {
  const corpus = 'the cat sat\nthe dog ran\na cat ran';
  const words = new Set(corpus.split(/\s+/));
  for (const s of sample(build(corpus))) {
    expect(s).not.toMatch(/\s{2}/);
    for (const w of s.split(' ')) expect(words).toContain(w);
  }
});

test('a longer context disambiguates what comes next', () => {
  // after "a" alone, b or c can follow; after "x a" only b, after "y a" only c
  const corpus = 'x a b\ny a c\nx a b\ny a c';
  const order1 = new Set(sample(build(corpus, 1)));
  const order2 = new Set(sample(build(corpus, 2)));
  expect(order1).toContain('x a c'); // order 1 mixes the two sentences
  expect([...order2].sort()).toEqual(['x a b', 'y a c']); // order 2 only reproduces them
});

test('sentences start with a word that started a corpus sentence', () => {
  const m = build('the cat sat on the mat\na dog sat on the rug', 1, 3);
  for (const s of sample(m)) expect(['the', 'a']).toContain(s.split(' ')[0]);
});

test('endChance is how often the last `order` words ended a sentence', () => {
  const corpus = 'I like that\nwe like that\nthey like that\nI saw that cat\nwe saw that dog\nI saw a fox';
  const m = build(corpus, 2);
  expect(m.endChance(['I', 'like', 'that'])).toBe(1);
  expect(m.endChance(['I', 'saw', 'that'])).toBe(0);
  expect(m.endChance(['saw', 'a'])).toBe(0);
  expect(m.endChance(['a', 'fox'])).toBe(1);
  m.setOrder(1);
  expect(m.endChance(['that'])).toBe(3 / 5); // "that" alone ended 3 of its 5 uses
  expect(m.endChance(['unknown'])).toBe(0);
});

test('sentences only end where the corpus ended one, within 3x the minimum length', () => {
  const corpus = 'the dog ran to the park\nthe cat sat on the mat\na bird flew to the tree\nthe dog sat on the cat';
  const enders = new Set(['park', 'mat', 'tree', 'cat']);
  for (const order of [1, 2]) {
    for (const s of sample(build(corpus, order, 3))) {
      const words = s.split(' ');
      expect(enders).toContain(words.at(-1));
      expect(words.length).toBeLessThanOrEqual(9);
    }
  }
});

test('an ending before the minimum length is skipped when anything else can follow', () => {
  // "a b" ends a sentence, but "b" can also continue to "c"
  const m = build('a b c d e f\na b', 1, 4);
  expect(new Set(sample(m))).toEqual(new Set(['a b c d e f']));
});

test('a sentence that reaches the cap is cut back to its most likely ending', () => {
  // "a b" loops; "b end" ends a sentence, so does "b" once in a while
  const m = build('a b a b a b a b end\na b a b a b a b a b a b', 1, 2);
  vi.spyOn(Math, 'random').mockReturnValue(0.999); // always take the last option: never "end"
  try {
    for (let i = 0; i < 20; i++) expect(m.sentence().split(' ').length).toBeLessThanOrEqual(6);
  } finally {
    vi.restoreAllMocks();
  }
});

test('generate capitalises and joins minSentences sentences', () => {
  const m = build('the cat sat\nthe dog ran');
  m.setMinSentences(3);
  const sentences = m.generate().split('. ').filter(Boolean);
  expect(sentences).toHaveLength(3);
  for (const s of sentences) expect(s).toMatch(/^The (cat sat|dog ran)$/);
});

test('pairs yields adjacent words within sentences only', () => {
  expect([...build('a b c\nd e').pairs()]).toEqual([['a', 'b'], ['b', 'c'], ['d', 'e']]);
});

test('topContexts lists the most frequent contexts with next-word counts, null for sentence end', () => {
  const m = build('the cat sat\nthe cat ran\nthe dog sat\na cat sat\nmy cat sat', 1);
  const rows = m.topContexts(2);
  expect(rows[0]).toEqual({context: 'cat', total: 4, links: [{next: 'sat', count: 3}, {next: 'ran', count: 1}]});
  expect(rows[1]).toEqual({context: 'sat', total: 4, links: [{next: null, count: 4}]});

  m.setOrder(2);
  expect(m.topContexts(1)[0]).toEqual({context: 'cat sat', total: 3, links: [{next: null, count: 3}]});
});

test('generated text rarely ends on a dangling word (real corpus)', async () => {
  const {clean} = await import('./textprep');
  const {default: raw} = await import('./corpus/tinystories.txt?raw');
  const m = build(clean(raw), 2, 10);
  const dangling = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'with', 'was']);
  let bad = 0;
  for (let i = 0; i < 500; i++) if (dangling.has(m.sentence().split(' ').at(-1).toLowerCase())) bad++;
  expect(bad / 500).toBeLessThan(0.03);
});
