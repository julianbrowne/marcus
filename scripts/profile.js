// Build-time corpus analysis with wink-nlp (runs in Node, never shipped to the browser).

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import {POS_GROUPS} from '../src/pos.js';

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
 * Returns {profile, posOf}: profile is plain JSON for the app; posOf maps a
 * normalised word to its most common part-of-speech group.
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
    doc.sentences().each((sentence) => {
      if (!sentence.out().trim()) return;
      const score = sentence.out(its.sentiment);
      sentences++;
      if (score > 0) positive++;
      if (score < 0) negative++;
    });

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
    entities: [...entities]
      .map(([type, m]) => ({
        type,
        count: [...m.values()].reduce((a, b) => a + b, 0),
        examples: [...m].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v),
      }))
      .sort((a, b) => b.count - a.count),
  };
  return {profile, posOf};
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
