// A synthetic corpus for the harness demo: agent transcripts, one per line, in the format the
// harness (src/harness.js) uses. Each is one trading day: the tool list, a user's share-price
// question, the assistant's tool call, the tool result and the assistant's answer.
//
//   node scripts/make-share-prices.mjs   (writes src/corpus/raw/share-prices.txt)
//
// Why it works for a chain: each line is one "sentence", so the whole exchange is one run of
// context. The ticker is chosen a few words after the company is named, and the answer's price is
// written 6 or 7 words after the tool result, so with enough context words (n) the chain sees
// them. Each company's prices are a random walk ending at today's fake-api price, so today's price
// (like every other) has been seen after its tool result. Questions have no "?" (the chain would
// split the line there). Kept as written: prepare-corpora.mjs doesn't clean it (cleaning strips
// the JSON). Deterministic (seeded), so it rebuilds identically.

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {COMPANIES, TOOLS_LINE, toolResult, toolUse} from '../src/harness.js';

const DAYS = 60; // transcripts per company

// {c} company, {s} company's
const QUESTIONS = [
  "What's {s} share price today", 'What is the share price of {c}', 'How much are {c} shares worth today',
  'Can you check the {c} share price for me', 'Give me the latest price for {c}', 'What are {c} shares trading at',
  'Look up the share price for {c} please', 'How are {c} shares doing today', "What's the current price of {c} stock",
];
// {c} company, {t} ticker, {p} price
const ANSWERS = ['{c} ({t}) is trading at {p} today.', '{c} ({t}) is at {p} right now.', '{c} shares are trading at {p} today.'];

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
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const lines = [];
  for (const [c, t, today] of COMPANIES) {
    // walk back from today's price, up to 1.5% a day
    const prices = [parseFloat(today)];
    while (prices.length < DAYS) prices.unshift(prices[0] * (1 + (rand() - 0.5) * 0.03));
    for (const price of prices) {
      const p = `${price.toFixed(1)}p`;
      const fill = (s) => s.replaceAll('{c}', c).replaceAll('{s}', `${c}'s`).replaceAll('{t}', t).replaceAll('{p}', p);
      lines.push(`${TOOLS_LINE} user: ${fill(pick(QUESTIONS))} assistant: ${toolUse(t)} ${toolResult(p)} assistant: ${fill(pick(ANSWERS))}`);
    }
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
  console.log(`wrote ${text.trim().split('\n').length} transcripts to src/corpus/raw/share-prices.txt`);
}
