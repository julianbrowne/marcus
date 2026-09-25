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

function chainFor(corpus) {
  const m = new Markov(corpus);
  m.buildChain();
  return m.chain;
}

test('words used in similar contexts cluster together', () => {
  const lines = [];
  for (const g of Object.keys(groups)) {
    for (const w of groups[g]) for (const p of preceders[g]) lines.push(`${p} ${w}`);
  }
  const points = embed(chainFor(lines.join('\n')));
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
  const points = embed(chainFor('On Monday.\non monday\nthe cat\nthe dog'), {rows: 2});
  expect(points).toHaveLength(2);
  expect(points[0].word).toBe('monday'); // most frequent, "Monday." merged in
  for (const p of points) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
});

test('"and" (preceded by almost everything) is not a lone outlier in a real corpus', () => {
  const points = embed(chainFor(grimm));
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
