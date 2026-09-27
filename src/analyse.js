// Corpus and text analysis with wink-nlp. Runs at build time (scripts/prepare-corpora.mjs) and,
// lazily loaded, in the browser to analyse generated text.

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import BM25Vectorizer from 'wink-nlp/utilities/bm25-vectorizer.js';
import {POS_GROUPS} from './pos.js';

const nlp = winkNLP(model);
const its = nlp.its;

const GROUP_OF = new Map(Object.entries(POS_GROUPS).flatMap(([group, tags]) => tags.map((t) => [t, group])));

// same normalisation the word map uses (src/embed.js)
const norm = (word) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

const pct = (n, total) => (total ? Math.round((1000 * n) / total) / 10 : 0);

function fleschBand(score) {
  if (score >= 90) return 'very easy';
  if (score >= 80) return 'easy';
  if (score >= 70) return 'fairly easy';
  if (score >= 60) return 'plain English';
  if (score >= 50) return 'fairly difficult';
  if (score >= 30) return 'difficult';
  return 'very difficult';
}

const CHUNK_CHARS = 1_000_000;

// split at paragraph (or failing that, line) breaks into pieces of about CHUNK_CHARS
function chunks(text) {
  const out = [];
  for (let at = 0; at < text.length;) {
    let cut = at + CHUNK_CHARS;
    if (cut < text.length) {
      const para = text.lastIndexOf('\n\n', cut);
      const line = text.lastIndexOf('\n', cut);
      cut = para > at ? para : line > at ? line : cut;
    }
    out.push(text.slice(at, cut));
    at = cut;
  }
  return out;
}

/**
 * Analyse prepared prose (punctuation and capitals intact), a chunk at a
 * time so memory stays flat on large corpora. With `byLine` (corpora with a
 * sentence per line and no punctuation, e.g. proverbs) each line gets a full
 * stop, otherwise wink reads the whole file as one sentence.
 * Returns {profile, posOf, contentWords}: profile is plain JSON for the app;
 * posOf maps a normalised word to its most common part-of-speech group;
 * contentWords maps each content word (lemma) to its count, for distinctiveWords().
 */
export function analyse(prose, byLine = false) {
  if (byLine) prose = prose.split('\n').filter((l) => l.trim()).map((l) => (/[.!?]\s*$/.test(l) ? l : `${l.trimEnd()}.`)).join('\n');
  const groupCounts = Object.fromEntries(Object.keys(POS_GROUPS).map((g) => [g, 0]));
  const tagsByWord = new Map(); // word -> Map(group -> count)
  const lemmas = new Map();
  const entities = new Map(); // type -> Map(value -> count)
  let words = 0;
  let negated = 0;
  let sentences = 0;
  let positive = 0;
  let negative = 0;
  let fleschWeighted = 0; // chunk Flesch scores weighted by chunk words
  let readabilityWords = 0;
  let complexWords = 0;
  let readingTimeSecs = 0;
  const tones = []; // each sentence's sentiment, in order, for the tone arc
  const keyCandidates = []; // {text, importance} of each chunk's most representative sentences

  for (const chunk of chunks(prose)) {
    const doc = nlp.readDoc(chunk);
    const r = doc.out(its.readabilityStats);
    // ponytail: word-weighted mean of chunk Flesch scores, exact only if chunks read alike; fine at ~1MB chunks
    fleschWeighted += r.fres * r.numOfWords;
    readabilityWords += r.numOfWords;
    complexWords += r.numOfComplexWords;
    readingTimeSecs += r.readingTimeMins * 60 + r.readingTimeSecs;

    doc.tokens().each((t) => {
      if (t.out(its.type) !== 'word') return;
      const group = GROUP_OF.get(t.out(its.pos));
      if (!group) return;
      words++;
      groupCounts[group]++;
      if (t.out(its.negationFlag)) negated++;

      const w = norm(t.out(its.normal));
      if (w) {
        if (!tagsByWord.has(w)) tagsByWord.set(w, new Map());
        const m = tagsByWord.get(w);
        m.set(group, (m.get(group) || 0) + 1);
      }

      // content words: not stop words, letters only (drops "mr." and "'s")
      const lemma = group === 'name' ? t.out() : (t.out(its.lemma) ?? t.out(its.normal)).toLowerCase();
      if (!t.out(its.stopWordFlag) && /^\p{L}[\p{L}'-]*\p{L}$/u.test(lemma)) lemmas.set(lemma, (lemmas.get(lemma) || 0) + 1);
    });

    // wink yields an empty "sentence" after trailing whitespace; skip it
    const texts = doc.sentences().out();
    doc.sentences().each((sentence, i) => {
      if (!texts[i].trim()) return;
      const score = sentence.out(its.sentiment);
      sentences++;
      tones.push(score);
      if (score > 0) positive++;
      if (score < 0) negative++;
    });

    // ponytail: importance is relative to its chunk, so key sentences are each chunk's best, then the best of those
    const readable = (text) => {
      const n = text.split(/\s+/).length;
      return n >= 8 && n <= 40; // wink favours very long sentences; keep ones a reader can take in
    };
    doc.out(its.sentenceWiseImportance)
      .filter(({index}) => readable(texts[index]))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
      .forEach(({index, importance}) => keyCandidates.push({text: texts[index].replace(/\s+/g, ' ').trim(), importance}));

    for (const {value, type} of doc.entities().out(its.detail)) {
      if (!entities.has(type)) entities.set(type, new Map());
      const m = entities.get(type);
      m.set(value, (m.get(value) || 0) + 1);
    }
  }

  const posOf = new Map([...tagsByWord].map(([w, m]) => [w, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
  const flesch = fleschWeighted / (readabilityWords || 1);

  const profile = {
    words,
    readability: {
      flesch: Math.round(flesch),
      band: fleschBand(flesch),
      complexWordsPct: pct(complexWords, readabilityWords),
      readingTimeMins: Math.round(readingTimeSecs / 60),
    },
    partsOfSpeech: Object.fromEntries(Object.entries(groupCounts).map(([g, n]) => [g, pct(n, words)])),
    sentiment: {
      sentences,
      positivePct: pct(positive, sentences),
      negativePct: pct(negative, sentences),
      neutralPct: pct(sentences - positive - negative, sentences),
    },
    negatedPer1000: Math.round((1000 * negated) / (words || 1)),
    topWords: [...lemmas].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({word, count})),
    keySentences: keyCandidates.sort((a, b) => b.importance - a.importance).slice(0, 5).map((k) => k.text),
    toneArc: toneArc(tones),
    entities: [...entities]
      .map(([type, m]) => ({
        type,
        count: [...m.values()].reduce((a, b) => a + b, 0),
        examples: [...m].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v),
      }))
      .sort((a, b) => b.count - a.count),
  };
  return {profile, posOf, contentWords: lemmas};
}

/**
 * Average sentence sentiment across the text, in `segments` equal slices of
 * sentences from start to finish: the shape of its tone. Values in [-1, 1].
 */
export function toneArc(tones, segments = 40) {
  if (tones.length === 0) return [];
  const n = Math.min(segments, tones.length);
  return Array.from({length: n}, (_, i) => {
    const slice = tones.slice(Math.floor((i * tones.length) / n), Math.floor(((i + 1) * tones.length) / n));
    return Math.round((1000 * slice.reduce((a, b) => a + b, 0)) / slice.length) / 1000;
  });
}

/**
 * Words that set each corpus apart from the others: BM25 (wink's vectorizer,
 * the corpora as its documents) over each corpus's content-word counts, so
 * words common everywhere score low and a corpus's own names and subjects
 * rise. countsByName: Map(name -> Map(word -> count)).
 */
export function distinctiveWords(countsByName, top = 12, minCount = 5) {
  // one entry per word regardless of case ("Wolf", "wolf", "WOLF"), shown in its most common form
  const display = new Map(); // lowercase -> Map(form -> count)
  const merged = new Map([...countsByName].map(([name, counts]) => {
    const m = new Map();
    for (const [word, count] of counts) {
      const key = word.toLowerCase();
      m.set(key, (m.get(key) || 0) + count);
      if (!display.has(key)) display.set(key, new Map());
      display.get(key).set(word, (display.get(key).get(word) || 0) + count);
    }
    return [name, m];
  }));
  const shown = (key) => [...display.get(key)].sort((a, b) => b[1] - a[1])[0][0];
  countsByName = merged;

  const names = [...countsByName.keys()];
  const bm25 = BM25Vectorizer();
  // ponytail: wink's vectorizer learns token lists; rebuilding them from counts costs one array entry per word used
  for (const name of names) {
    const tokens = [];
    for (const [word, count] of countsByName.get(name)) for (let i = 0; i < count; i++) tokens.push(word);
    bm25.learn(tokens);
  }
  return new Map(names.map((name, i) => {
    const counts = countsByName.get(name);
    const weights = bm25.doc(i).out(its.bow);
    const ranked = Object.entries(weights)
      .filter(([word]) => counts.get(word) >= minCount) // one-off oddities aren't what sets a corpus apart
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([word]) => shown(word));
    return [name, ranked];
  }));
}

/**
 * How often a map word's nearest neighbours share its part of speech,
 * against how often two random map words do.
 */
export function neighbourAgreement(points, k = 5) {
  const tagged = points.filter((p) => p.pos);
  if (tagged.length <= k) return null;
  let agree = 0;
  for (const p of tagged) {
    const nearest = tagged
      .filter((q) => q !== p)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, k);
    agree += nearest.filter((q) => q.pos === p.pos).length / k;
  }
  const counts = new Map();
  for (const p of tagged) counts.set(p.pos, (counts.get(p.pos) || 0) + 1);
  const n = tagged.length;
  const chance = [...counts.values()].reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1));
  return {neighbours: k, sharePct: pct(agree, n), chancePct: pct(chance * 1000, 1000)};
}
