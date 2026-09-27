// Build-time corpus preparation: src/corpus/raw/*.txt ->
//   src/corpus/clean/<name>.txt     one clean sentence per line (what the Markov chain reads)
//   src/corpus/profile/<name>.json  corpus profile + word map points with parts of speech
//
//   node scripts/prepare-corpora.mjs [--force]
//
// Runs before dev, build and test. A corpus is skipped when its outputs are
// newer than its raw file and the code that produces them.

import {readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync} from 'node:fs';
import {clean, prepare} from '../src/textprep.js';
import {Markov} from '../src/markov.js';
import {embed} from '../src/embed.js';
import {analyse, neighbourAgreement} from './profile.js';

const MAP_WORDS = 300; // words on the word map
const dir = (name) => new URL(`../src/corpus/${name}/`, import.meta.url);
const RAW = dir('raw');
const CLEAN = dir('clean');
const PROFILE = dir('profile');
const CODE = ['../src/textprep.js', '../src/markov.js', '../src/embed.js', './profile.js', './prepare-corpora.mjs']
  .map((f) => new URL(f, import.meta.url));

const force = process.argv.includes('--force');
const mtime = (url) => (existsSync(url) ? statSync(url).mtimeMs : 0);
const codeTime = Math.max(...CODE.map(mtime));

mkdirSync(CLEAN, {recursive: true});
mkdirSync(PROFILE, {recursive: true});

for (const file of readdirSync(RAW).filter((f) => f.endsWith('.txt')).sort()) {
  const name = file.replace(/\.txt$/, '');
  const raw = new URL(file, RAW);
  const cleanOut = new URL(`${name}.txt`, CLEAN);
  const profileOut = new URL(`${name}.json`, PROFILE);
  const inputsTime = Math.max(mtime(raw), codeTime);
  if (!force && Math.min(mtime(cleanOut), mtime(profileOut)) > inputsTime) continue;

  const started = performance.now();
  const text = readFileSync(raw, 'utf8');
  const cleaned = clean(text);
  writeFileSync(cleanOut, cleaned);

  const prepared = prepare(text);
  const {profile, posOf} = analyse(prepared.text, prepared.byLine);
  const markov = new Markov(cleaned);
  markov.buildChain();
  const points = embed(markov.pairs(), {rows: MAP_WORDS}).map((p) => ({...p, pos: posOf.get(p.word) ?? null}));

  const lines = cleaned.split('\n');
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
