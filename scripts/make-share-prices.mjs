// A synthetic corpus for the harness demo: share-price questions, each followed by a tool token
// ($price-<ticker>) and a continuation with NUM placeholders the harness fills in.
//
//   node scripts/make-share-prices.mjs   (writes src/corpus/raw/share-prices.txt)
//
// Synthetic because no real text pairs questions with tool calls like this. Lines have no sentence
// punctuation, so the cleaner keeps each question and its tool call in one sentence. Deterministic
// (seeded shuffle), so it rebuilds identically.

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const COMPANIES = [
  ['tesco', 'tsco'], ['sainsbury', 'sbry'], ['barclays', 'barc'], ['bp', 'bp'],
  ['unilever', 'ulvr'], ['vodafone', 'vod'], ['lloyds', 'lloy'], ['shell', 'shel'],
];

const QUESTIONS = [
  'what is the {c} share price', 'whats the {c} share price today', 'how much are {c} shares worth',
  'tell me the current price of {c} shares', 'give me the latest {c} stock price', 'check the price of {c} for me',
  'how are {c} shares doing today', 'i would like to know the {c} share price', 'look up {c} on the stock market',
  'what are {c} shares trading at', 'can you get me a quote for {c}', 'price check on {c} please',
];
const ANSWERS = [
  'result NUM so {c} shares are trading at NUM pence',
  'result NUM which means {c} is at NUM pence a share',
  'result NUM so the price of {c} is NUM pence',
];
const SELLS = ['sell my {c} shares', 'please sell all my {c} shares now', 'get rid of my {c} shares', 'i want to sell my {c} holding'];
const SOLD = 'result NUM so your {c} shares have been sold at NUM pence';
const NOISY = 24; // lines whose tool call names the wrong company

// mulberry32: a small seeded generator, so the corpus is the same every time
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shareCorpus() {
  const rand = random(2026);
  const fill = (template, name) => template.replaceAll('{c}', name);
  const lines = [];
  for (const [name, ticker] of COMPANIES) {
    for (const q of QUESTIONS) for (const a of ANSWERS) lines.push(`${fill(q, name)} $price-${ticker} ${fill(a, name)}`);
    for (const s of SELLS) lines.push(`${fill(s, name)} $sell-${ticker} ${fill(SOLD, name)}`);
  }
  for (let i = 0; i < NOISY; i++) {
    const [name] = COMPANIES[i % COMPANIES.length];
    const [, wrong] = COMPANIES[(i % COMPANIES.length + 1 + Math.floor(rand() * (COMPANIES.length - 1))) % COMPANIES.length];
    const q = QUESTIONS[Math.floor(rand() * QUESTIONS.length)];
    lines.push(`${fill(q, name)} $price-${wrong} ${fill(ANSWERS[0], name)}`);
  }
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = shareCorpus();
  writeFileSync(new URL('../src/corpus/raw/share-prices.txt', import.meta.url), text);
  console.log(`wrote ${text.trim().split('\n').length} lines to src/corpus/raw/share-prices.txt`);
}
