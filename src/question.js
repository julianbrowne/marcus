// Questions and analogies over a word space (src/corpus/space/<name>.json): similarity retrieval
// over word co-occurrence. No generation: the "answer" is just the words whose vectors point the
// same way as the question's.

import {norm} from './embed.js';

// words that carry the question's shape, not its subject
const STOPWORDS = new Set(`a an the of in on at to for by with from into about as and or but is are was were be been
  being it its this that these those what which who whom whose where when why how do does did has have had can could
  will would shall should may might must i me my we our you your he him his she her they them their there here tell
  please name`.split(/\s+/));

// {words, counts, dims, vectors (flat)} -> {words, count, vector(i), index: Map(word -> i), total}
export function loadSpace({words, counts, dims, vectors}) {
  const vecs = Float32Array.from(vectors);
  return {
    words,
    count: (i) => counts[i],
    vector: (i) => vecs.subarray(i * dims, (i + 1) * dims),
    index: new Map(words.map((w, i) => [w, i])),
    total: counts.reduce((a, b) => a + b, 0),
    dims,
  };
}

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const unit = (v) => {
  const len = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / len);
};

/**
 * A question as a vector: its non-stopwords that the space knows, each weighted by
 * inverse frequency (log(total / count), so rare, specific words count more), then
 * the weighted average of their unit vectors. {vector, used: [{word, weight}], unknown}
 */
export function queryVector(space, text) {
  const words = text.split(/\s+/).map(norm).filter((w) => w && !STOPWORDS.has(w));
  const used = [];
  const unknown = [];
  const sum = new Float64Array(space.dims);
  for (const word of new Set(words)) {
    const i = space.index.get(word);
    if (i === undefined) {
      unknown.push(word);
      continue;
    }
    const weight = Math.log(space.total / space.count(i));
    used.push({word, weight: Math.round(weight * 100) / 100});
    space.vector(i).forEach((x, d) => { sum[d] += weight * x; });
  }
  return {vector: used.length ? unit(Array.from(sum)) : null, used, unknown};
}

// the k words whose vectors are most similar (cosine, all dimensions) to a unit vector;
// stopwords aren't answers, just as they aren't part of the question
export function nearest(space, vector, k = 10, exclude = []) {
  const skip = new Set(exclude);
  const scored = [];
  for (let i = 0; i < space.words.length; i++) {
    const word = space.words[i];
    if (!skip.has(word) && !STOPWORDS.has(word)) scored.push({word, similarity: dot(space.vector(i), vector)});
  }
  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}

/**
 * a - b + c (paris - france + italy): the nearest words to that vector, not counting
 * a, b or c. {results, unknown}
 */
export function analogy(space, a, b, c, k = 10) {
  const words = [a, b, c].map(norm);
  const unknown = words.filter((w) => !space.index.has(w));
  if (unknown.length) return {results: [], unknown};
  const [va, vb, vc] = words.map((w) => space.vector(space.index.get(w)));
  const target = unit(Array.from(va, (x, d) => x - vb[d] + vc[d]));
  return {results: nearest(space, target, k, words), unknown};
}
