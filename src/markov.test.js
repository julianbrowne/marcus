import {Markov} from './markov';

test('buildChain links each word to the next n words', () => {
  const m = new Markov('the cat sat on the mat');
  m.setNgrams(2);
  m.buildChain();
  expect(m.chain.the).toEqual(['cat sat', 'mat']);
  expect(m.chain.cat).toEqual(['sat on']);
  expect(m.chain).not.toHaveProperty('mat'); // last word has no successor
  expect(Object.keys(m.startWords)).toEqual(['the']);
  expect(Object.keys(m.endWords)).toEqual(['mat']);
});

test('generate only emits corpus words, one sentence per minSentences', () => {
  const corpus = 'the cat sat\nthe dog ran\na cat ran';
  const words = new Set(corpus.split(/\s+/));
  const m = new Markov(corpus);
  m.setMinWords(1);
  m.setMinSentences(3);
  m.buildChain();

  const sentences = m.generate().split('. ').filter(Boolean);
  expect(sentences).toHaveLength(3);
  for (const s of sentences) {
    expect(s).not.toMatch(/\s{2}/);
    for (const w of s.toLowerCase().split(' ')) expect(words).toContain(w);
  }
});
