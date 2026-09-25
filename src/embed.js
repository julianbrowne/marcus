// Word embedding from a Markov chain: count which words precede each word,
// weight with PPMI, then project to 2D with PCA so words used in similar
// contexts land near each other.

const norm = (word) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const topByCount = (counts, n) =>
  [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word]) => word);

// ponytail: dense rows x cols matrix; keep rows ~hundreds (it's also what fits on screen)
export function embed(chain, {rows = 200, cols = 1000} = {}) {
  const preceders = new Map(); // word -> Map(preceding word -> count)
  const wordCount = new Map();
  const prevCount = new Map();

  // every chain entry "prev -> 'next ...'" means prev immediately precedes next
  for (const [prevRaw, segments] of Object.entries(chain)) {
    const prev = norm(prevRaw);
    if (!prev) continue;
    for (const segment of segments) {
      const word = norm(segment.split(' ')[0]);
      if (!word) continue;
      if (!preceders.has(word)) preceders.set(word, new Map());
      const m = preceders.get(word);
      m.set(prev, (m.get(prev) || 0) + 1);
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
      prevCount.set(prev, (prevCount.get(prev) || 0) + 1);
    }
  }

  const words = topByCount(wordCount, rows);
  const contexts = topByCount(prevCount, cols);
  const col = new Map(contexts.map((c, j) => [c, j]));

  const X = words.map((w) => {
    const row = new Float64Array(contexts.length);
    for (const [p, n] of preceders.get(w)) if (col.has(p)) row[col.get(p)] = n;
    return row;
  });

  // PPMI: max(0, log(p(w,c) / (p(w) p(c))))
  const rowSum = X.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = new Float64Array(contexts.length);
  for (const r of X) r.forEach((n, j) => { colSum[j] += n; });
  const total = rowSum.reduce((a, b) => a + b, 0);
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < contexts.length; j++) {
      const n = X[i][j];
      X[i][j] = n ? Math.max(0, Math.log((n * total) / (rowSum[i] * colSum[j]))) : 0;
    }
  }

  // unit-length rows (cosine geometry): otherwise words with many distinct
  // preceders, like "and", get big rows and dominate the first axis alone
  for (const r of X) {
    const len = Math.sqrt(dot(r, r));
    if (len) r.forEach((v, j) => { r[j] = v / len; });
  }

  // PCA: centre columns, then top 2 eigenvectors of the small words x words Gram matrix
  for (let j = 0; j < contexts.length; j++) {
    let mean = 0;
    for (const r of X) mean += r[j];
    mean /= X.length;
    for (const r of X) r[j] -= mean;
  }
  const G = X.map((a) => X.map((b) => dot(a, b)));

  const axes = [];
  for (let a = 0; a < 2; a++) {
    // not all-ones: that's in the null space of a centred Gram matrix
    let v = words.map((_, i) => Math.sin(i + 1 + a));
    let lambda = 0;
    for (let it = 0; it < 200; it++) {
      for (const {u} of axes) {
        const d = dot(v, u);
        v = v.map((x, i) => x - d * u[i]);
      }
      const w = G.map((r) => dot(r, v));
      lambda = Math.sqrt(dot(w, w));
      if (!lambda) break;
      v = w.map((x) => x / lambda);
    }
    axes.push({u: v, scale: Math.sqrt(lambda)});
  }

  return words.map((word, i) => ({
    word,
    x: axes[0].u[i] * axes[0].scale,
    y: axes[1].u[i] * axes[1].scale,
  }));
}
