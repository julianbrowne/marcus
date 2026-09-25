// Order-n Markov chain: the next word depends on the last `order` words
// (the "context"), like an LLM's context window but with counts instead of
// learned weights.
//
// The corpus is stored once as token ids, with 0 marking sentence
// boundaries, plus a suffix array: every position sorted by the words that
// follow it. All occurrences of a context are then one contiguous block of
// the suffix array, found by binary search, so any order from 1 to
// MAX_ORDER works from the same index. Within a block, occurrences are
// sorted by their next token, and since the boundary is 0, the ones where
// the sentence ended come first.

export const MAX_ORDER = 10;
const BOUNDARY = 0;

export class Markov {
  constructor(corpus) {
    this.corpus = corpus;
    this.order = 1;
    this.minWordsInSentence = 8;
    this.minSentences = 5;
  }

  setOrder(n) {
    this.order = n;
  }

  setMinWords(n) {
    this.minWordsInSentence = n;
  }

  setMinSentences(n) {
    this.minSentences = n;
  }

  buildChain() {
    this.words = [null]; // id -> word; id 0 is the sentence boundary
    const ids = new Map();
    const tokens = [BOUNDARY];
    // one sentence per line, or split on ". ", "! ", "? "
    for (const line of this.corpus.split(/(?<=[.!?])\s+|\r?\n/)) {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      for (const word of words) {
        let id = ids.get(word);
        if (id === undefined) {
          id = this.words.length;
          ids.set(word, id);
          this.words.push(word);
        }
        tokens.push(id);
      }
      tokens.push(BOUNDARY);
    }
    this.ids = ids;
    this.tokens = Int32Array.from(tokens);

    // every position except the final boundary, which has nothing after it
    this.suffixes = new Int32Array(this.tokens.length - 1).map((_, i) => i);
    this.suffixes.sort((a, b) => this.compareAt(a, b, MAX_ORDER + 1));
  }

  compareAt(a, b, depth) {
    const t = this.tokens;
    for (let d = 0; d < depth; d++) {
      const x = a + d < t.length ? t[a + d] : -1;
      const y = b + d < t.length ? t[b + d] : -1;
      if (x !== y) return x - y;
    }
    return 0;
  }

  compareContext(pos, context) {
    const t = this.tokens;
    for (let d = 0; d < context.length; d++) {
      const x = pos + d < t.length ? t[pos + d] : -1;
      if (x !== context[d]) return x - context[d];
    }
    return 0;
  }

  // first suffix-array index whose suffix is >= context (compared on context's length)
  lowerBound(context) {
    let lo = 0;
    let hi = this.suffixes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.compareContext(this.suffixes[mid], context) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // all occurrences of context are suffixes[start..end); the sentence ended after suffixes[start..endsUntil)
  block(context) {
    const last = context.length - 1;
    return {
      start: this.lowerBound(context),
      endsUntil: this.lowerBound([...context, BOUNDARY + 1]),
      end: this.lowerBound([...context.slice(0, last), context[last] + 1]),
    };
  }

  // the last `order` token ids of a sentence so far, led by the sentence-start
  // boundary while the sentence is shorter than that
  contextFor(sentenceIds) {
    return [BOUNDARY, ...sentenceIds].slice(-Math.min(this.order, sentenceIds.length + 1));
  }

  /**
   * Chance that a sentence ending in these words ends here: how often the
   * same context (its last `order` words) ended a sentence in the corpus.
  **/
  endChance(sentence) {
    const ids = sentence.map((w) => this.ids.get(w));
    if (ids.includes(undefined)) return 0;
    const {start, endsUntil, end} = this.block(this.contextFor(ids));
    return end > start ? (endsUntil - start) / (end - start) : 0;
  }

  generate() {
    let paragraph = '';
    for (let i = 0; i < this.minSentences; i++) {
      const s = this.sentence();
      if (s !== '') paragraph += s.charAt(0).toUpperCase() + s.slice(1).trim() + '. ';
    }
    return paragraph;
  }

  /**
   * One sentence, a word at a time, each sampled from what followed the
   * current context in the corpus. It ends where the corpus did, not before
   * the minimum length. If it reaches 3x the minimum first it's cut back to
   * its most likely ending. Attempts that can only end too early (a word
   * that only ever ends sentences) or never pass a plausible ending are
   * retried; if all fail, a short but properly ended one is preferred.
  **/
  sentence() {
    let fallback;
    let attempt;
    for (let i = 0; i < 10; i++) {
      attempt = this.attemptSentence();
      if (attempt.ended && attempt.longEnough) return attempt.text;
      if (attempt.ended) fallback ??= attempt;
    }
    return (fallback ?? attempt).text; // ponytail: 10 tries; only odd corpora get here
  }

  attemptSentence() {
    const maxWords = this.minWordsInSentence * 3;
    const ids = [];
    let best = {length: 0, chance: 0}; // most likely ending at or past the minimum length
    let bestShort = {length: 0, chance: 0}; // ...and before it
    const text = () => ids.map((id) => this.words[id]).join(' ');
    const result = (ended) => ({text: text(), ended, longEnough: ids.length >= this.minWordsInSentence});

    while (true) {
      const context = this.contextFor(ids);
      const {start, endsUntil, end} = this.block(context);
      const longEnough = ids.length >= this.minWordsInSentence;
      const chance = (endsUntil - start) / (end - start);
      if (ids.length > 0) {
        if (longEnough && chance > best.chance) best = {length: ids.length, chance};
        if (!longEnough && chance > bestShort.chance) bestShort = {length: ids.length, chance};
      }

      // before the minimum length, skip the endings if anything else can follow
      const from = longEnough || endsUntil === end ? start : endsUntil;
      const next = this.tokens[this.suffixes[from + Math.floor(Math.random() * (end - from))] + context.length];

      if (next === BOUNDARY) return result(ids.length > 0);
      if (ids.length >= maxWords) {
        const cut = best.chance > 0 ? best : bestShort;
        if (cut.chance > 0) ids.length = cut.length;
        return result(cut.chance > 0);
      }
      ids.push(next);
    }
  }

  // [previous word, word] for every adjacent pair within a sentence
  * pairs() {
    const t = this.tokens;
    for (let i = 0; i + 1 < t.length; i++) {
      if (t[i] !== BOUNDARY && t[i + 1] !== BOUNDARY) yield [this.words[t[i]], this.words[t[i + 1]]];
    }
  }

  /**
   * The chain's states: the `top` most frequent contexts (`order` words in
   * a row within a sentence), each with what followed it, most frequent
   * first. A null `next` means the sentence ended there.
   * [{context, total, links: [{next, count}]}]
  **/
  topContexts(top) {
    const sa = this.suffixes;
    const t = this.tokens;
    const k = this.order;
    const inSentence = (pos) => {
      for (let d = 0; d < k; d++) if (pos + d >= t.length || t[pos + d] === BOUNDARY) return false;
      return true;
    };

    // occurrences of each context are contiguous in the suffix array
    const groups = [];
    for (let i = 0; i < sa.length;) {
      let j = i + 1;
      while (j < sa.length && this.compareAt(sa[i], sa[j], k) === 0) j++;
      if (inSentence(sa[i])) groups.push([i, j]);
      i = j;
    }
    groups.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));

    return groups.slice(0, top).map(([i, j]) => {
      // ...and within a context, sorted by the next token
      const links = [];
      for (let a = i; a < j;) {
        const next = t[sa[a] + k];
        let b = a + 1;
        while (b < j && t[sa[b] + k] === next) b++;
        links.push({next: next === BOUNDARY ? null : this.words[next], count: b - a});
        a = b;
      }
      links.sort((x, y) => y.count - x.count);
      const pos = sa[i];
      return {context: Array.from(t.subarray(pos, pos + k), (id) => this.words[id]).join(' '), total: j - i, links};
    });
  }
}
