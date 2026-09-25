import {Markov} from './markov';
import {embed} from './embed';
import grimm from './corpus/grimm.txt?raw';

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
  const {clean} = await import('./textprep');
  const {default: raw} = await import('./corpus/pride-and-prejudice.txt?raw');
  const pairs = [...pairsFor(clean(raw))];
  // the order the old chain gave: grouped by previous word (this mirrored the y axis)
  const groups = new Map();
  for (const pair of pairs) groups.set(pair[0], [...(groups.get(pair[0]) || []), pair]);
  const a = embed(pairs, {rows: 300}); // as the app uses it
  const b = new Map(embed([...groups.values()].flat(), {rows: 300}).map((p) => [p.word, p]));
  const same = a.filter((p) => b.has(p.word));
  const agree = (axis) => same.filter((p) => Math.sign(p[axis]) === Math.sign(b.get(p.word)[axis])).length / same.length;
  expect(agree('x')).toBeGreaterThan(0.95); // a mirrored axis gives ~0
  expect(agree('y')).toBeGreaterThan(0.95);
});
