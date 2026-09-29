// Word embedding: count which words appear next to each word (the word
// before it, or any within a window), weight with PPMI, then reduce with PCA
// so words used in similar contexts land near each other. dims = 2 gives a
// map; more dimensions keep more of the structure for similarity search.

export const norm = (word) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const topByCount = (counts, n) =>
  [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word]) => word);

/**
 * [context word, word] pairs from sentences (arrays of words). window 0: the
 * word before each word, which groups words that can stand in for each other
 * (paris with london). window k: every word within k either side, which groups
 * words that go together (paris with france).
 */
export function* contextPairs(sentences, window = 0) {
  for (const words of sentences) {
    for (let i = 0; i < words.length; i++) {
      if (window === 0) {
        if (i > 0) yield [words[i - 1], words[i]];
        continue;
      }
      for (let j = Math.max(0, i - window); j <= Math.min(words.length - 1, i + window); j++) {
        if (j !== i) yield [words[j], words[i]];
      }
    }
  }
}

/**
 * Top k eigenvectors of a symmetric matrix (array of Float64Array rows) by
 * block power iteration: multiply, then re-orthonormalise (Gram-Schmidt).
 * The start is deterministic, and not all-ones, which is in the null space
 * of a centred Gram matrix. Returns [{v, lambda}], largest first.
 */
function topEigen(G, k, iterations) {
  const n = G.length;
  let V = Array.from({length: k}, (_, a) => Float64Array.from({length: n}, (_, i) => Math.sin(i + 1 + a)));
  let lambdas = new Array(k).fill(0);
  for (let it = 0; it < iterations; it++) {
    const W = V.map((v) => Float64Array.from(G, (row) => dot(row, v)));
    lambdas = W.map((w, a) => dot(w, V[a]));
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < a; b++) {
        const d = dot(W[a], W[b]);
        for (let i = 0; i < n; i++) W[a][i] -= d * W[b][i];
      }
      const len = Math.sqrt(dot(W[a], W[a]));
      if (len) for (let i = 0; i < n; i++) W[a][i] /= len;
    }
    V = W;
  }
  return V.map((v, a) => ({v, lambda: lambdas[a]}));
}

// ponytail: dense rows x cols matrix and a dense Gram on its smaller side; fine to a few thousand words
// pairs: iterable of [context word, word], e.g. Markov.pairs() or contextPairs()
export function embed(pairs, {rows = 200, cols = 1000, dims = 2} = {}) {
  const contextsOf = new Map(); // word -> Map(context word -> count)
  const wordCount = new Map();
  const contextCount = new Map();

  for (const [contextRaw, wordRaw] of pairs) {
    const context = norm(contextRaw);
    const word = norm(wordRaw);
    if (!context || !word) continue;
    if (!contextsOf.has(word)) contextsOf.set(word, new Map());
    const m = contextsOf.get(word);
    m.set(context, (m.get(context) || 0) + 1);
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
    contextCount.set(context, (contextCount.get(context) || 0) + 1);
  }

  const words = topByCount(wordCount, rows);
  const contexts = topByCount(contextCount, cols);
  const col = new Map(contexts.map((c, j) => [c, j]));

  const X = words.map((w) => {
    const row = new Float64Array(contexts.length);
    for (const [c, n] of contextsOf.get(w)) if (col.has(c)) row[col.get(c)] = n;
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
  // contexts, like "and", get big rows and dominate the first axis alone
  for (const r of X) {
    const len = Math.sqrt(dot(r, r));
    if (len) r.forEach((v, j) => { r[j] = v / len; });
  }

  // PCA: centre columns, then the top eigenvectors of the smaller Gram matrix.
  // words x words gives each word's coordinates as u * sqrt(lambda);
  // contexts x contexts gives the axes, and coordinates are X . axis
  for (let j = 0; j < contexts.length; j++) {
    let mean = 0;
    for (const r of X) mean += r[j];
    mean /= X.length;
    for (const r of X) r[j] -= mean;
  }
  const k = Math.min(dims, words.length, contexts.length);
  const iterations = dims > 2 ? 60 : 200;
  let coords; // coords[a][i]: word i on axis a
  if (words.length <= contexts.length) {
    const G = X.map((a) => Float64Array.from(X, (b) => dot(a, b)));
    coords = topEigen(G, k, iterations).map(({v, lambda}) => v.map((x) => x * Math.sqrt(Math.max(lambda, 0))));
  } else {
    const G = Array.from({length: contexts.length}, (_, a) => {
      const row = new Float64Array(contexts.length);
      for (const r of X) { const ra = r[a]; if (ra) for (let b = 0; b < contexts.length; b++) row[b] += ra * r[b]; }
      return row;
    });
    coords = topEigen(G, k, iterations).map(({v}) => Float64Array.from(X, (r) => dot(r, v)));
  }
  // an axis's direction is arbitrary: point it so the most frequent word is positive,
  // otherwise the picture can mirror when nothing meaningful changed
  for (const axis of coords) if (axis[0] < 0) for (let i = 0; i < axis.length; i++) axis[i] = -axis[i];

  return words.map((word, i) => {
    const point = {word, x: coords[0][i], y: coords[1][i]};
    if (dims > 2) {
      const v = coords.map((axis) => axis[i]);
      const len = Math.sqrt(dot(v, v)) || 1;
      point.vector = v.map((x) => x / len);
      point.count = wordCount.get(word);
    }
    return point;
  });
}
