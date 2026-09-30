// Build-time corpus preparation: src/corpus/raw/*.txt ->
//   src/corpus/clean/<name>.txt     one clean sentence per line (what the Markov chain reads)
//   src/corpus/profile/<name>.json  corpus profile + word map points with parts of speech
//   src/corpus/cache/<name>.json    content-word counts (build-only), for distinctive words
//   src/corpus/space/<name>.json    word vectors for asking questions, for the corpora in space-settings.mjs
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
import {SPACES as SPACE_SETTINGS} from './space-settings.mjs';

const MAP_WORDS = 500; // words on the word map
// already one clean line per sentence, kept as written: agent transcripts whose JSON cleaning would strip
const AS_IS = new Set(['share-prices']);
// word spaces (+/-4 word window: groups paris with france), only for the corpora that use them.
// Building one takes 1-2s (26s for the 67 books), so it's done here, not in the browser
const dir = (name) => new URL(`../src/corpus/${name}/`, import.meta.url);
const RAW = dir('raw');
const CLEAN = dir('clean');
const PROFILE = dir('profile');
const CACHE = dir('cache');
const SPACES = dir('space');
const CODE = ['../src/textprep.js', '../src/markov.js', '../src/embed.js', '../src/analyse.js', './prepare-corpora.mjs', './space-settings.mjs']
  .map((f) => new URL(f, import.meta.url));

const force = process.argv.includes('--force');
const mtime = (url) => (existsSync(url) ? statSync(url).mtimeMs : 0);
const codeTime = Math.max(...CODE.map(mtime));

mkdirSync(CLEAN, {recursive: true});
mkdirSync(PROFILE, {recursive: true});
mkdirSync(CACHE, {recursive: true});
mkdirSync(SPACES, {recursive: true});

// remove outputs whose raw file has gone (renamed or deleted corpora), and spaces no longer wanted
const names = new Set(readdirSync(RAW).filter((f) => f.endsWith('.txt')).map((f) => f.replace(/\.txt$/, '')));
const spaced = new Set([...names].filter((n) => n in SPACE_SETTINGS));
for (const [folder, ext, keep] of [[CLEAN, '.txt', names], [PROFILE, '.json', names], [CACHE, '.json', names], [SPACES, '.json', spaced]]) {
  for (const f of readdirSync(folder).filter((f) => f.endsWith(ext) && !keep.has(f.slice(0, -ext.length)))) {
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
  const outputs = [cleanOut, profileOut, cacheOut, ...(spaced.has(name) ? [spaceOut] : [])];
  if (!force && Math.min(...outputs.map(mtime)) > inputsTime) continue;

  const started = performance.now();
  const text = readFileSync(raw, 'utf8');
  const cleaned = AS_IS.has(name) ? text.trim() : clean(text);
  writeFileSync(cleanOut, cleaned);

  const prepared = prepare(text);
  const {profile, posOf, contentWords} = analyse(prepared.text, prepared.byLine);
  writeFileSync(cacheOut, JSON.stringify(Object.fromEntries(contentWords)));
  const markov = new Markov(cleaned);
  markov.buildChain();
  const points = embed(markov.pairs(), {rows: MAP_WORDS}).map((p) => ({...p, pos: posOf.get(p.word) ?? null}));

  const lines = cleaned.split('\n');
  if (spaced.has(name)) {
    const settings = SPACE_SETTINGS[name];
    const space = embed(contextPairs(lines.map((l) => l.split(' ')), settings.window), settings);
    const round = (x) => Math.round(x * 1000) / 1000;
    writeFileSync(spaceOut, JSON.stringify({
      window: settings.window,
      dims: space[0]?.vector.length ?? 0,
      words: space.map((p) => p.word),
      counts: space.map((p) => p.count),
      vectors: space.flatMap((p) => p.vector.map(round)), // unit vectors, row after row
    }));
  }
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
