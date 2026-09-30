// A synthetic geography corpus for the ask feature: short, factual, encyclopaedia-style sentences
// about real countries and their capitals, structured so that similarity retrieval over word
// co-occurrence gets "what is the capital of X" and "city - country + country" right.
//
//   node scripts/make-geography.mjs   (writes src/corpus/raw/geography.txt)
//
// Why it works: a country, its capital and its demonym are named together (within the 4-word window
// the word space uses), so they share contexts no other pair has; the demonym links country and
// capital equally but never sits next to "capital" or "city", so for "capital of X" the capital, not
// the demonym, is nearest; and every capital gets the same "capital city" sentences and every country
// the same "nation" sentences, so city - country is the same offset for every pair. Only single-word names are
// used (so "new delhi" can't split), and only sentences true of every pair listed. Deterministic.

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// [country, capital, demonym, region]
export const PAIRS = [
  ['France', 'Paris', 'French', 'Europe'], ['Italy', 'Rome', 'Italian', 'Europe'],
  ['Germany', 'Berlin', 'German', 'Europe'], ['Spain', 'Madrid', 'Spanish', 'Europe'],
  ['Portugal', 'Lisbon', 'Portuguese', 'Europe'], ['Greece', 'Athens', 'Greek', 'Europe'],
  ['Poland', 'Warsaw', 'Polish', 'Europe'], ['Austria', 'Vienna', 'Austrian', 'Europe'],
  ['Hungary', 'Budapest', 'Hungarian', 'Europe'], ['Norway', 'Oslo', 'Norwegian', 'Europe'],
  ['Sweden', 'Stockholm', 'Swedish', 'Europe'], ['Finland', 'Helsinki', 'Finnish', 'Europe'],
  ['Denmark', 'Copenhagen', 'Danish', 'Europe'], ['Ireland', 'Dublin', 'Irish', 'Europe'],
  ['Belgium', 'Brussels', 'Belgian', 'Europe'], ['Netherlands', 'Amsterdam', 'Dutch', 'Europe'],
  ['Switzerland', 'Bern', 'Swiss', 'Europe'], ['Romania', 'Bucharest', 'Romanian', 'Europe'],
  ['Bulgaria', 'Sofia', 'Bulgarian', 'Europe'], ['Serbia', 'Belgrade', 'Serbian', 'Europe'],
  ['Croatia', 'Zagreb', 'Croatian', 'Europe'], ['Czechia', 'Prague', 'Czech', 'Europe'],
  ['Slovakia', 'Bratislava', 'Slovak', 'Europe'], ['Ukraine', 'Kyiv', 'Ukrainian', 'Europe'],
  ['Russia', 'Moscow', 'Russian', 'Europe'], ['Latvia', 'Riga', 'Latvian', 'Europe'],
  ['Lithuania', 'Vilnius', 'Lithuanian', 'Europe'], ['Estonia', 'Tallinn', 'Estonian', 'Europe'],
  ['Iceland', 'Reykjavik', 'Icelandic', 'Europe'], ['Turkey', 'Ankara', 'Turkish', 'Asia'],
  ['Iran', 'Tehran', 'Iranian', 'Asia'], ['Iraq', 'Baghdad', 'Iraqi', 'Asia'],
  ['Syria', 'Damascus', 'Syrian', 'Asia'], ['Lebanon', 'Beirut', 'Lebanese', 'Asia'],
  ['Jordan', 'Amman', 'Jordanian', 'Asia'], ['Qatar', 'Doha', 'Qatari', 'Asia'],
  ['Oman', 'Muscat', 'Omani', 'Asia'], ['Afghanistan', 'Kabul', 'Afghan', 'Asia'],
  ['Pakistan', 'Islamabad', 'Pakistani', 'Asia'], ['Bangladesh', 'Dhaka', 'Bangladeshi', 'Asia'],
  ['Nepal', 'Kathmandu', 'Nepali', 'Asia'], ['China', 'Beijing', 'Chinese', 'Asia'],
  ['Japan', 'Tokyo', 'Japanese', 'Asia'], ['Mongolia', 'Ulaanbaatar', 'Mongolian', 'Asia'],
  ['Thailand', 'Bangkok', 'Thai', 'Asia'], ['Vietnam', 'Hanoi', 'Vietnamese', 'Asia'],
  ['Laos', 'Vientiane', 'Lao', 'Asia'], ['Philippines', 'Manila', 'Filipino', 'Asia'],
  ['Egypt', 'Cairo', 'Egyptian', 'Africa'], ['Morocco', 'Rabat', 'Moroccan', 'Africa'],
  ['Nigeria', 'Abuja', 'Nigerian', 'Africa'], ['Ghana', 'Accra', 'Ghanaian', 'Africa'],
  ['Senegal', 'Dakar', 'Senegalese', 'Africa'], ['Kenya', 'Nairobi', 'Kenyan', 'Africa'],
  ['Uganda', 'Kampala', 'Ugandan', 'Africa'], ['Tanzania', 'Dodoma', 'Tanzanian', 'Africa'],
  ['Zambia', 'Lusaka', 'Zambian', 'Africa'], ['Zimbabwe', 'Harare', 'Zimbabwean', 'Africa'],
  ['Angola', 'Luanda', 'Angolan', 'Africa'], ['Canada', 'Ottawa', 'Canadian', 'America'],
  ['Cuba', 'Havana', 'Cuban', 'America'], ['Colombia', 'Bogota', 'Colombian', 'America'],
  ['Venezuela', 'Caracas', 'Venezuelan', 'America'], ['Ecuador', 'Quito', 'Ecuadorian', 'America'],
  ['Peru', 'Lima', 'Peruvian', 'America'], ['Chile', 'Santiago', 'Chilean', 'America'],
  ['Uruguay', 'Montevideo', 'Uruguayan', 'America'], ['Paraguay', 'Asuncion', 'Paraguayan', 'America'],
  ['Brazil', 'Brasilia', 'Brazilian', 'America'], ['Australia', 'Canberra', 'Australian', 'Oceania'],
  ['Fiji', 'Suva', 'Fijian', 'Oceania'], ['Samoa', 'Apia', 'Samoan', 'Oceania'],
  ['Tuvalu', 'Funafuti', 'Tuvaluan', 'Oceania'], ['Palau', 'Ngerulmud', 'Palauan', 'Oceania'],
];

// {c} country, {k} capital, {d} demonym, {r} region. Demonyms never sit next to "capital" or
// "city": that's the capital's job, and a demonym there would out-score the capital for "capital of X"
const PAIR = [
  'The capital of {c} is {k}.',
  '{k} is the capital of {c}.',
  '{k} is the capital city of {c}.',
  '{c} is a country in {r}.', // the region with the country only: a small region's name would otherwise tie its pairs
  'People from {c} are called {d}.',
  'The {d} people live in {c}.',
  'Many {d} people live in {k}.',
  '{k} is home to many {d} people.',
];
// every sentence must be true for every pair listed (Ngerulmud is tiny; not every country holds elections)
const CITY = [ // the same for every capital
  '{k} is a capital city.',
  'As a capital, {k} is marked on most maps.',
  'Travellers can visit the capital {k}.',
];
const COUNTRY = [ // the same for every country
  '{c} is a nation with its own flag and anthem.',
  '{c} is a member state of the United Nations.',
  'The nation of {c} issues its own passports.',
];

// mulberry32: a small seeded generator, so the corpus is the same every time
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function geographyCorpus() {
  const rand = random(1945);
  const paragraphs = PAIRS.map(([c, k, d, r]) => {
    const fill = (t) => t.replaceAll('{c}', c).replaceAll('{k}', k).replaceAll('{d}', d).replaceAll('{r}', r);
    const sentences = [...PAIR, ...CITY, ...COUNTRY].map(fill);
    for (let i = sentences.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [sentences[i], sentences[j]] = [sentences[j], sentences[i]];
    }
    return sentences.join(' ');
  });
  return `${paragraphs.join('\n\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = geographyCorpus();
  writeFileSync(new URL('../src/corpus/raw/geography.txt', import.meta.url), text);
  console.log(`wrote ${PAIRS.length} countries (${text.length.toLocaleString()} characters) to src/corpus/raw/geography.txt`);
}
