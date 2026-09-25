// Download public-domain English books from Project Gutenberg into one corpus file.
//
//   node scripts/fetch-gutenberg.mjs [count]
//
// The list is the Gutenberg "Top 100 EBooks last 30 days" (September 2026), filtered to
// English text, one edition per title, no omnibus/dictionary volumes, and only books
// whose authors and translators died by 1955 (public domain in the UK as well as the US).
// Files come from PGLAF's mirror with a delay between requests, per
// https://www.gutenberg.org/policy/robot_access.html. Each book keeps its Gutenberg
// header/footer; stripGutenberg() in src/textprep.js removes them at load time.

import {writeFileSync} from 'node:fs';

const MIRROR = 'https://gutenberg.pglaf.org/cache/epub';
const DELAY_MS = 2000;
const OUT = new URL('../src/corpus/gutenberg.txt', import.meta.url);

const BOOKS = [
  [2701, "Moby Dick; Or, The Whale"],
  [1342, "Pride and Prejudice"],
  [1727, "The Odyssey (tr. Samuel Butler)"],
  [1513, "Romeo and Juliet"],
  [2554, "Crime and Punishment"],
  [3268, "The Mysteries of Udolpho"],
  [2465, "Carmen"],
  [67979, "The Blue Castle: a novel"],
  [2868, "The Green Mummy"],
  [1661, "The Adventures of Sherlock Holmes"],
  [34413, "The Love Letters of Mary Wollstonecraft to Gilbert Imlay"],
  [1260, "Jane Eyre: An Autobiography"],
  [11, "Alice's Adventures in Wonderland"],
  [59828, "The String of Pearls; Or, The Barber of Fleet Street. A Domestic Romance."],
  [345, "Dracula"],
  [3011, "The Lady of the Lake"],
  [1695, "The Man Who Was Thursday: A Nightmare"],
  [6133, "The Extraordinary Adventures of Ars\u00e8ne Lupin, Gentleman-Burglar"],
  [21839, "Sense and Sensibility"],
  [2680, "Meditations"],
  [601, "The Monk: A Romance"],
  [145, "Middlemarch"],
  [76639, "Eloisa"],
  [72, "Thuvia, maid of Mars"],
  [19476, "A Honeymoon in Space"],
  [468, "Manon Lescaut"],
  [43, "The strange case of Dr. Jekyll and Mr. Hyde"],
  [8492, "The King in Yellow"],
  [37106, "Little Women; Or, Meg, Jo, Beth, and Amy"],
  [564, "The Mystery of Edwin Drood"],
  [1184, "The Count of Monte Cristo"],
  [3296, "The Confessions of St. Augustine"],
  [1259, "Twenty years after"],
  [245, "Life on the Mississippi"],
  [36462, "King Arthur and the Knights of the Round Table"],
  [70854, "The Countess of Pembroke's Arcadia"],
  [393, "The Blue Lagoon: A Romance"],
  [53874, "Under the Red Dragon: A Novel"],
  [24793, "Blow The Man Down: A Romance Of The Coast"],
  [589, "Catriona"],
  [244, "A Study in Scarlet"],
  [23784, "The History of Sir Richard Calmady: A Romance"],
  [2852, "The Hound of the Baskervilles"],
  [23, "Narrative of the Life of Frederick Douglass, an American Slave"],
  [103, "Around the World in Eighty Days"],
  [42389, "The Pirate Andrew Lang Edition"],
  [224, "A pair of blue eyes"],
  [51428, "That Which Hath Wings: A Novel of the Day"],
  [53416, "Only a girl's love"],
  [17460, "Lorna Doone: A Romance of Exmoor"],
  [1212, "Love and Freindship [sic]"],
  [55179, "One of the Six Hundred: A Novel"],
  [48296, "Linnet: A Romance"],
  [18459, "Hypnerotomachia: The Strife of Loue in a Dreame"],
  [2002, "Sonnets from the Portuguese"],
  [32155, "The Love Letters of Henry VIII to Anne Boleyn; With Notes"],
  [35548, "Doctor Cupid: A Novel"],
  [14244, "The Romance of Tristan and Iseult"],
  [28203, "Moods"],
  [1523, "As You Like It"],
  [1608, "Camille (La Dame aux Camilias)"],
  [49987, "Forest Days: A Romance of Old Times"],
  [2825, "Undine"],
  [46276, "The Treasure of Pearls: A Romance of Adventures in California"],
  [31472, "Cynthia's Chauffeur"],
  [53154, "Cameron of Lochiel"],
  [36725, "On the Cross: A Romance of the Passion Play at Oberammergau"],
];

const count = Number(process.argv[2]) || BOOKS.length;
const texts = [];
for (const [id, title] of BOOKS.slice(0, count)) {
  const res = await fetch(`${MIRROR}/${id}/pg${id}.txt`);
  if (res.ok) {
    texts.push(await res.text());
    console.log(`ok   ${id} ${title}`);
  } else {
    console.warn(`FAIL ${id} ${title} (HTTP ${res.status})`);
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}
writeFileSync(OUT, texts.join('\n\n'));
console.log(`wrote ${texts.length} books to src/corpus/gutenberg.txt`);
