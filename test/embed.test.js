import {Markov} from '../src/markov';
import {embed} from '../src/embed';
import grimm from './fixtures/grimm.txt?raw';

const groups = {
  days: ['monday', 'tuesday', 'friday'],
  animals: ['cat', 'dog', 'horse'],
  motion: ['ran', 'walked', 'jumped'],
};
const preceders = {
  days: ['on', 'every', 'next', 'last'],
  animals: ['the', 'a', 'my', 'your'],
  motion: ['he', 'she', 'they', 'we'],
};

function pairsFor(corpus) {
  const m = new Markov(corpus);
  m.buildChain();
  return m.pairs();
}

test('words used in similar contexts cluster together', () => {
  const lines = [];
  for (const g of Object.keys(groups)) {
    for (const w of groups[g]) for (const p of preceders[g]) lines.push(`${p} ${w}`);
  }
  const points = embed(pairsFor(lines.join('\n')));
  const groupOf = (word) => Object.keys(groups).find((g) => groups[g].includes(word));

  expect(points.map((p) => p.word).sort()).toEqual(Object.values(groups).flat().sort());
  for (const p of points) {
    const nearest = points
      .filter((q) => q !== p)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    expect(groupOf(nearest.word)).toBe(groupOf(p.word));
  }
});

test('normalises case and punctuation and caps rows', () => {
  const points = embed(pairsFor('On Monday.\non monday\nthe cat\nthe dog'), {rows: 2});
  expect(points).toHaveLength(2);
  expect(points[0].word).toBe('monday'); // most frequent, "Monday." merged in
  for (const p of points) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
});

test('"and" (preceded by almost everything) is not a lone outlier in a real corpus', () => {
  const points = embed(pairsFor(grimm));
  const and = points.find((p) => p.word === 'and');
  const mostExtremeX = points.reduce((a, b) => (Math.abs(b.x) > Math.abs(a.x) ? b : a));
  const nearest = points
    .filter((q) => q !== and)
    .sort((a, b) => Math.hypot(a.x - and.x, a.y - and.y) - Math.hypot(b.x - and.x, b.y - and.y))
    .slice(0, 6)
    .map((q) => q.word);
  expect(mostExtremeX.word).not.toBe('and');
  expect(nearest).toContain('but');
});

test('the picture keeps its orientation whatever order the pairs arrive in', async () => {
  const {clean} = await import('../src/textprep');
  // grimm: without the orientation rule, reversing its pairs mirrors both axes at 300 words
  const pairs = [...pairsFor(clean(grimm))];
  const groups = new Map();
  for (const pair of pairs) groups.set(pair[0], [...(groups.get(pair[0]) || []), pair]);
  const orders = [
    pairs,
    [...pairs].reverse(),
    [...groups.values()].flat(), // the order the old chain gave, which once mirrored the map
    [...pairs].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)),
  ];
  const maps = orders.map((o) => embed(o, {rows: 300})); // 300 words is where grimm flips without the rule
  const reference = new Map(maps[0].map((p) => [p.word, p]));
  for (const points of maps) {
    // the rule: each axis points so the most frequent word is on the positive side
    expect(points[0].x).toBeGreaterThanOrEqual(0);
    expect(points[0].y).toBeGreaterThanOrEqual(0);
    const same = points.filter((p) => reference.has(p.word));
    const agree = (axis) => same.filter((p) => Math.sign(p[axis]) === Math.sign(reference.get(p.word)[axis])).length / same.length;
    expect(agree('x')).toBeGreaterThan(0.9); // a mirrored axis gives ~0; words right on an axis can wobble
    expect(agree('y')).toBeGreaterThan(0.9);
  }
});

describe('questions and analogies over a windowed word space', async () => {
  const {contextPairs} = await import('../src/embed');
  const {loadSpace, queryVector, nearest, analogy} = await import('../src/question');
  // four countries, each with its capital and its own things; every fact said a few ways
  const facts = [
    ['paris', 'france', 'wine', 'cheese'],
    ['rome', 'italy', 'pasta', 'pizza'],
    ['madrid', 'spain', 'paella', 'flamenco'],
    ['berlin', 'germany', 'beer', 'sausage'],
  ];
  const sentences = facts.flatMap(([city, country, a, b]) => [
    `${city} is the capital of ${country}`,
    `the capital of ${country} is ${city}`,
    `${city} ${country} ${a} ${b}`,
    `in ${country} people love ${a} and ${b}`,
    `in ${city} people love ${a} and ${b}`,
  ]).map((s) => s.split(' '));
  const points = embed(contextPairs(sentences, 4), {rows: 100, cols: 100, dims: 8});
  const space = loadSpace({
    words: points.map((p) => p.word), counts: points.map((p) => p.count),
    dims: points[0].vector.length, vectors: points.flatMap((p) => p.vector),
  });

  test('contextPairs: window 0 is the word before; window k is every word within k', () => {
    expect([...contextPairs([['a', 'b', 'c']], 0)]).toEqual([['a', 'b'], ['b', 'c']]);
    expect([...contextPairs([['a', 'b', 'c']], 1)]).toEqual([['b', 'a'], ['a', 'b'], ['c', 'b'], ['b', 'c']]);
  });

  test('vectors are unit length, with counts', () => {
    for (const p of points) expect(Math.hypot(...p.vector)).toBeCloseTo(1, 5);
    expect(points.find((p) => p.word === 'paris').count).toBeGreaterThan(0);
  });

  test('"what is the capital of france" retrieves paris', () => {
    const q = queryVector(space, 'What is the capital of France?');
    expect(q.used.map((u) => u.word)).toEqual(['capital', 'france']); // stopwords dropped, case and ? normalised
    expect(q.used[1].weight).toBeGreaterThan(q.used[0].weight); // rarer word weighs more
    expect(nearest(space, q.vector, 1, ['capital', 'france'])[0].word).toBe('paris');
  });

  test('unknown words are reported, not guessed', () => {
    expect(queryVector(space, 'capital of atlantis').unknown).toEqual(['atlantis']);
    expect(queryVector(space, 'what is it').vector).toBeNull();
  });

  test('paris - france + italy = rome', () => {
    const {results} = analogy(space, 'paris', 'france', 'italy');
    expect(results[0].word).toBe('rome');
    expect(results.map((r) => r.word)).not.toContain('paris'); // inputs excluded
    expect(analogy(space, 'paris', 'france', 'narnia').unknown).toEqual(['narnia']);
  });
});

test('the synthetic geography corpus answers every "capital of X" question and analogy', async () => {
  const {clean} = await import('../src/textprep');
  const {contextPairs} = await import('../src/embed');
  const {loadSpace, queryVector, nearest, analogy} = await import('../src/question');
  const {geographyCorpus, PAIRS} = await import('../scripts/make-geography.mjs');
  const {SPACES} = await import('../scripts/space-settings.mjs');
  const settings = SPACES.geography; // exactly as the build makes it
  const lines = clean(geographyCorpus()).split('\n').map((l) => l.split(' '));
  const points = embed(contextPairs(lines, settings.window), settings);
  const space = loadSpace({
    words: points.map((p) => p.word), counts: points.map((p) => p.count),
    dims: points[0].vector.length, vectors: points.flatMap((p) => p.vector),
  });
  const wrong = [];
  for (const [country, capital] of PAIRS) {
    const q = queryVector(space, `what is the capital of ${country}`);
    const top = nearest(space, q.vector, 1, q.used.map((u) => u.word))[0].word;
    if (top !== capital.toLowerCase()) wrong.push(`${country}: ${top}`);
  }
  expect(wrong).toEqual([]);
  // a spread of analogies: every capital - its country, + every 5th other country
  for (const [c1, k1] of PAIRS) {
    for (const [c2, k2] of PAIRS.filter((_, i) => i % 5 === 0)) {
      if (c1 !== c2) expect(analogy(space, k1, c1, c2, 1).results[0].word).toBe(k2.toLowerCase());
    }
  }
});
