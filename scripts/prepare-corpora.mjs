// Build-time corpus preparation: src/corpus/raw/*.txt ->
//   src/corpus/clean/<name>.txt     one clean sentence per line (what the Markov chain reads)
//   src/corpus/profile/<name>.json  corpus profile + word map points with parts of speech
//   src/corpus/cache/<name>.json    content-word counts (build-only), for distinctive words
//   src/corpus/space/<name>.json    word vectors (2000 words x 50 dims, +/-4 word window) for asking questions
//
// Distinctive words compare every corpus with the others, so they're scored in a final
// pass over all the cached counts and written into each profile.
//
//   node scripts/prepare-corpora.mjs [--force]
//
// Runs before dev, build and test. A corpus is skipped when its outputs are
// newer than its raw file and the code that produces them.

import {readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync, rmSync} from 'node:fs';
import {clean, prepare} from '../src/textprep.js';
import {Markov} from '../src/markov.js';
import {embed, contextPairs} from '../src/embed.js';
import {analyse, neighbourAgreement, distinctiveWords} from '../src/analyse.js';

const MAP_WORDS = 500; // words on the word map
// the question space: associated words (a +/-4 word window groups paris with france), many dimensions
// for similarity. Building it takes 1-2s (26s for the 67 books), so it's done here, not in the browser
const SPACE = {window: 4, rows: 2000, cols: 500, dims: 50};
// the instruction demo ("make no mistakes") runs on the 67 books; words like mistakes/error/correct
// rank 2,500-7,000 there, so its space keeps 8,000 words (others stay at 2,000 to keep files small)
const SPACE_ROWS = {'gutenberg-67-books': 8000};
const dir = (name) => new URL(`../src/corpus/${name}/`, import.meta.url);
const RAW = dir('raw');
const CLEAN = dir('clean');
const PROFILE = dir('profile');
const CACHE = dir('cache');
const SPACES = dir('space');
const CODE = ['../src/textprep.js', '../src/markov.js', '../src/embed.js', '../src/analyse.js', './prepare-corpora.mjs']
  .map((f) => new URL(f, import.meta.url));

const force = process.argv.includes('--force');
const mtime = (url) => (existsSync(url) ? statSync(url).mtimeMs : 0);
const codeTime = Math.max(...CODE.map(mtime));

mkdirSync(CLEAN, {recursive: true});
mkdirSync(PROFILE, {recursive: true});
mkdirSync(CACHE, {recursive: true});
mkdirSync(SPACES, {recursive: true});

// remove outputs whose raw file has gone (renamed or deleted corpora)
const names = new Set(readdirSync(RAW).filter((f) => f.endsWith('.txt')).map((f) => f.replace(/\.txt$/, '')));
for (const [folder, ext] of [[CLEAN, '.txt'], [PROFILE, '.json'], [CACHE, '.json'], [SPACES, '.json']]) {
  for (const f of readdirSync(folder).filter((f) => f.endsWith(ext) && !names.has(f.slice(0, -ext.length)))) {
    rmSync(new URL(f, folder));
    console.log(`removed stale ${f}`);
  }
}

for (const file of readdirSync(RAW).filter((f) => f.endsWith('.txt')).sort()) {
  const name = file.replace(/\.txt$/, '');
  const raw = new URL(file, RAW);
  const cleanOut = new URL(`${name}.txt`, CLEAN);
  const profileOut = new URL(`${name}.json`, PROFILE);
  const cacheOut = new URL(`${name}.json`, CACHE);
  const spaceOut = new URL(`${name}.json`, SPACES);
  const inputsTime = Math.max(mtime(raw), codeTime);
  if (!force && Math.min(mtime(cleanOut), mtime(profileOut), mtime(cacheOut), mtime(spaceOut)) > inputsTime) continue;

  const started = performance.now();
  const text = readFileSync(raw, 'utf8');
  const cleaned = clean(text);
  writeFileSync(cleanOut, cleaned);

  const prepared = prepare(text);
  const {profile, posOf, contentWords} = analyse(prepared.text, prepared.byLine);
  writeFileSync(cacheOut, JSON.stringify(Object.fromEntries(contentWords)));
  const markov = new Markov(cleaned);
  markov.buildChain();
  const points = embed(markov.pairs(), {rows: MAP_WORDS}).map((p) => ({...p, pos: posOf.get(p.word) ?? null}));

  const lines = cleaned.split('\n');
  const space = embed(contextPairs(lines.map((l) => l.split(' ')), SPACE.window), {...SPACE, rows: SPACE_ROWS[name] ?? SPACE.rows});
  const round = (x) => Math.round(x * 1000) / 1000;
  writeFileSync(spaceOut, JSON.stringify({
    window: SPACE.window,
    dims: space[0]?.vector.length ?? 0,
    words: space.map((p) => p.word),
    counts: space.map((p) => p.count),
    vectors: space.flatMap((p) => p.vector.map(round)), // unit vectors, row after row
  }));
  writeFileSync(profileOut, JSON.stringify({
    name,
    rawChars: text.length,
    sentences: lines.length,
    distinctWords: new Set(cleaned.toLowerCase().split(/\s+/)).size,
    wordsPerSentence: Math.round((10 * cleaned.split(/\s+/).length) / lines.length) / 10,
    ...profile,
    map: {points, agreement: neighbourAgreement(points)},
  }));
  console.log(`prepared ${name} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

// distinctive words: every corpus against all the others
const counts = new Map([...names].sort().map((name) =>
  [name, new Map(Object.entries(JSON.parse(readFileSync(new URL(`${name}.json`, CACHE), 'utf8'))))]));
for (const [name, words] of distinctiveWords(counts)) {
  const file = new URL(`${name}.json`, PROFILE);
  const profile = JSON.parse(readFileSync(file, 'utf8'));
  if (JSON.stringify(profile.distinctiveWords) === JSON.stringify(words)) continue;
  writeFileSync(file, JSON.stringify({...profile, distinctiveWords: words}));
}
