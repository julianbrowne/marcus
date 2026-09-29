// Download Wikipedia articles for every sovereign state and its capital city into one corpus file.
//
//   node scripts/fetch-wikipedia.mjs [count]
//
// Countries come from "List of sovereign states" (the bold, flagged entries in its table);
// capitals from "List of national capitals" (rows whose country is bold, i.e. sovereign;
// continuation rows under a rowspan inherit that). Articles are plain-text extracts from the
// MediaWiki API, one request at a time with a delay and a descriptive User-Agent, per
// https://www.mediawiki.org/wiki/API:Etiquette. Each is cut to its lead and whole sections
// up to ARTICLE_CHARS so the corpus stays under ~5 MB. Text is CC BY-SA 4.0 (see SOURCES.md).

import {writeFileSync} from 'node:fs';

const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'marcus-corpus-fetcher/1.0 (https://github.com/julianbrowne/marcus)';
const DELAY_MS = 200;
const ARTICLE_CHARS = 10_000;
const OUT = new URL('../src/corpus/raw/geography.txt', import.meta.url);

async function api(params) {
  const url = `${API}?${new URLSearchParams({format: 'json', formatversion: '2', maxlag: '5', ...params})}`;
  const res = await fetch(url, {headers: {'User-Agent': USER_AGENT}});
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const wikitext = async (page) => (await api({action: 'parse', page, prop: 'wikitext'})).parse.wikitext;

async function sovereignStates() {
  const w = await wikitext('List of sovereign states');
  return [...w.matchAll(/^\|<span id="[^"]*"><\/span>'''\{\{flag\|([^}|]+)(?:\|[^}]*)?\}\}'''/gm)].map((m) => m[1].trim());
}

async function capitalCities() {
  const w = await wikitext('List of national capitals');
  const cities = [];
  let sovereign = false;
  for (const row of w.split('\n|-').slice(1)) {
    const city = row.match(/^[^\n]*\n\|\s*\[\[([^\]|]+)/);
    if (!city) continue;
    // a row with its own country cell says whether that country is sovereign (bold); else it continues the one above
    if (/\|\|[^\n]*\{\{/.test(row)) sovereign = /\|\|[^\n]*'''\{\{/.test(row);
    if (sovereign) cities.push(city[1].trim());
  }
  return cities;
}

// lead + whole "== Section ==" blocks while they fit
function trim(text) {
  const blocks = text.split(/\n(?===[^=])/);
  let out = blocks[0];
  for (const block of blocks.slice(1)) {
    if (out.length + block.length > ARTICLE_CHARS) break;
    out += `\n${block}`;
  }
  return out.slice(0, ARTICLE_CHARS);
}

const titles = [...new Set([...await sovereignStates(), ...await capitalCities()])];
const count = Number(process.argv[2]) || titles.length;
const articles = [];
for (const title of titles.slice(0, count)) {
  const page = (await api({action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1', titles: title})).query.pages[0];
  if (page?.extract) {
    articles.push(`= ${page.title} =\n\n${trim(page.extract)}`);
    console.log(`ok   ${title}`);
  } else {
    console.warn(`FAIL ${title}`);
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}
const text = articles.join('\n\n');
writeFileSync(OUT, text);
console.log(`wrote ${articles.length} articles (${(text.length / 1e6).toFixed(1)} MB) to src/corpus/raw/geography.txt`);
