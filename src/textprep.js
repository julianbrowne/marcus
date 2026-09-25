// Text preparation: turn raw text into one clean sentence per line, ready
// for Markov.buildChain(). Each step is exported so it can be tested alone;
// clean() runs them in order.

const ABBREVIATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'St', 'Jr', 'Sr', 'Mt', 'vs', 'etc', 'approx', 'No'];
const FILLERS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm'];
const PRONOUN_I = /^I('(m|ve|ll|d))?$/;

/**
 * Unicode and typography: one canonical form for each character.
 * NFKC also folds compatibility forms, e.g. "…" -> "..." and non-breaking space -> space.
 */
export function normaliseUnicode(text) {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑]/g, '-') // unicode hyphens
    .replace(/\s*(?:[‒-―]|--+)\s*/g, ' - ') // figure/en/em dashes and "--"
    .replace(/[​-‍⁠﻿]/g, '') // zero-width characters
    .replace(/[^\S\n]+/g, ' ') // tabs and other spaces
    .replace(/[\p{Cc}\p{Co}]/gu, (c) => (c === '\n' ? c : '')); // control/private-use characters
}

/**
 * Project Gutenberg eBooks: keep only the text between each
 * "*** START OF ... ***" and "*** END OF ... ***" pair (a file may hold many
 * books), and drop any remaining line that mentions Project Gutenberg (their
 * licence asks for all references to go if the licence text goes).
 */
export function stripGutenberg(text) {
  const books = [...text.matchAll(/\*{3} ?START OF [^\n]*PROJECT GUTENBERG[^\n]*\n([\s\S]*?)\n[^\n]*\*{3} ?END OF [^\n]*PROJECT GUTENBERG/gi)];
  if (!books.length) return text;
  return books
    .map((b) => b[1])
    .join('\n\n')
    .split('\n')
    .filter((line) => !/gutenberg/i.test(line))
    .join('\n');
}

/**
 * Undo tokenisation in pre-tokenised corpora like WikiText: "role @-@ playing",
 * "1 @,@ 000", "the game 's", "do n't", and "= = Heading = =" lines.
 */
export function detokenise(text) {
  return text
    .replace(/ @([-,.])@ /g, '$1')
    .replace(/ (?=(?:'s|'re|'ve|'ll|'d|'m|n't)\b)/gi, '')
    .replace(/^ *(?:= )+[^=\n]*(?: =)+ *$/gm, '');
}

/**
 * Remove things that aren't prose: HTML, URLs, emails and transcript
 * annotations like [applause] or (inaudible).
 */
export function stripNonProse(text) {
  return text
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/&(amp|quot|apos|#39|nbsp|lt|gt);/g, (_, e) => ({amp: '&', quot: '"', apos: "'", '#39': "'", nbsp: ' ', lt: ' ', gt: ' '})[e])
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, ' ')
    .replace(/\S+@\S+\.\w+/g, ' ')
    .replace(/\[[^\]]{0,500}\]|\([^)\n]*\)/g, ' '); // [notes] may span lines, e.g. [Illustration: ...]
}

/**
 * Drop lines that are labels rather than sentences: speaker names
 * ("First Citizen:") and headings with no lowercase letters ("THE GOLDEN BIRD").
 * With `titles`, also title-case lines with no closing punctuation, i.e.
 * headings, contents entries and bylines ("The Wolf and the Lamb",
 * "by Lewis Carroll"), and short numbered headings ("CHAPTER 26. Knights
 * and Squires."). Only safe for prose: in one-sentence-per-line
 * corpora "Merry Christmas Michigan" is a real sentence.
 */
const isLabel = (line) => /^\s*[A-Z][\w .'-]{0,40}:\s*$/.test(line) || /^[^a-z]*[A-Z]{2}[^a-z]*$/.test(line);

const TITLE_SMALL_WORDS = new Set('a an the and or but nor of in on at to for by with from into upon as his her its their'.split(' '));
const HEADING = /^\s*(chapter|book|part|volume|act|scene|canto|letter|stave)\s+([ivxlcdm]+|\d+)\b/i;
const isTitle = (line) => {
  const words = line.trim().split(/\s+/);
  if (words.length > 15) return false;
  if (HEADING.test(line)) return true;
  return !/[.!?,;:"')\]]$/.test(line.trim()) &&
    words.some((w) => /^\p{Lu}/u.test(w)) &&
    words.every((w) => !/^\p{Ll}/u.test(w) || TITLE_SMALL_WORDS.has(w));
};

export function removeLabelLines(text, titles = false) {
  return text.split('\n').map((line) => (isLabel(line) || (titles && isTitle(line)) ? '' : line)).join('\n');
}

/**
 * Some corpora have one sentence per line and no sentence punctuation
 * (e.g. proverbs); others wrap sentences across lines.
 * ponytail: heuristic (<10% of lines end in . ! ? :); pass an option if a corpus fools it
 */
export function linesAreSentences(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const punctuated = lines.filter((l) => /[.!?:;]["')\]]*\s*$/.test(l)).length;
  return punctuated < lines.length * 0.1;
}

/**
 * Split into sentences with the platform's sentence segmenter (Unicode UAX #29).
 * Blank lines are always boundaries; abbreviations are de-dotted first so
 * "Mr. Smith" and "the U.S. auto industry" don't split. Reported speech
 * (`he said, "You're lucky`) starts a new sentence at the opening quote.
 */
export function splitSentences(text, byLine = linesAreSentences(text)) {
  const protectedText = text
    .replace(new RegExp(`\\b(${ABBREVIATIONS.join('|')})\\.(?=\\s)`, 'g'), '$1')
    .replace(/\b(?:[A-Za-z]\.){2,}/g, (m) => m.replace(/\./g, ''));

  const blocks = byLine ? protectedText.split('\n') : protectedText.split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' '));
  const segmenter = new Intl.Segmenter('en', {granularity: 'sentence'});
  return blocks
    .flatMap((block) => [...segmenter.segment(block)])
    .flatMap((s) => s.segment.split(/(?<=[,:])\s*(?=["']\p{Lu})/u))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalise one sentence to space-separated words: no quotes, no sentence
 * punctuation, no fillers or stutters. Keeps contractions (don't),
 * hyphenated words (African-American), money ($45), percentages (97%),
 * decimals (1.5), grades (A+) and ampersands (AT&T).
 */
export function cleanSentence(sentence) {
  // whitespace-bounded: \b would match the "er" in "ne'er"
  const fillers = new RegExp(`(?<=^|\\s)(${FILLERS.join('|')})(?=\\s|$)`, 'gi');
  const cleaned = sentence
    .replace(/"/g, ' ')
    .replace(/''+/g, "'") // closing quote + apostrophe: 'Verily''s
    .replace(/(^|[^\p{L}\p{N}])'+|'+(?=[^\p{L}\p{N}]|$)/gu, '$1 ') // quote marks, not apostrophes
    .replace(/(\d)\.(?=\d)/g, '$1\u0000') // protect decimal points
    .replace(/[^\p{L}\p{N}\s'$%+&\-\u0000]/gu, ' ') // all other punctuation
    .replace(/\u0000/g, '.')
    .replace(/(^|\s)[-+&']+(?=\s|$)|(^|\s)-+|-+(?=\s|$)/g, '$1$2 ') // dangling -, + or & (false starts "campaign-")
    .replace(/(^|\s)%/g, '$1') // % not attached to a number
    .replace(fillers, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapseRepeats(cleaned);
}

/**
 * Stutters: "by the way by the way" -> "by the way", "no no no" -> "no".
 * Repeats until stable so cleaning twice gives the same result.
 */
export function collapseRepeats(sentence) {
  let prev;
  do {
    prev = sentence;
    sentence = sentence.replace(/(?<=^|\s)(\S+(?:\s\S+){0,3})(?:\s\1)+(?=\s|$)/gi, '$1');
  } while (sentence !== prev);
  return sentence;
}

/**
 * Drop immediately repeated sentences ("Thank you. Thank you. Thank you.").
 */
export function dropRepeats(sentences) {
  return sentences.filter((s, i) => i === 0 || s.toLowerCase() !== sentences[i - 1].toLowerCase());
}

/**
 * Truecase sentence-initial words so "The" and "the" are one Markov state.
 * Each first word takes the casing it most often has mid-sentence (ties go
 * lowercase). Mid-sentence capitals are left alone: they're deliberate
 * (Vice President Pence). Words never seen mid-sentence are lowercased
 * unless they're "I" or have internal capitals (US, McDonald).
 */
export function truecase(sentences) {
  const forms = new Map(); // lowercase -> Map(form -> mid-sentence count)
  for (const s of sentences) {
    for (const w of s.split(' ').slice(1)) {
      const key = w.toLowerCase();
      if (!forms.has(key)) forms.set(key, new Map());
      forms.get(key).set(w, (forms.get(key).get(w) || 0) + 1);
    }
  }
  const lowerFirst = (a) => (a === a.toLowerCase() ? -1 : 1);
  const recase = (w) => {
    if (/\p{Lu}/u.test(w.slice(1)) || PRONOUN_I.test(w)) return w;
    const seen = forms.get(w.toLowerCase());
    return seen ? [...seen].sort((a, b) => b[1] - a[1] || lowerFirst(a[0]))[0][0] : w.toLowerCase();
  };
  return sentences.map((s) => {
    const [first, ...rest] = s.split(' ');
    return [recase(first), ...rest].join(' ');
  });
}

/**
 * Full pipeline: raw text -> one clean sentence per line.
 */
export function clean(text) {
  const text2 = stripNonProse(detokenise(stripGutenberg(normaliseUnicode(text))));
  const byLine = linesAreSentences(text2);
  const sentences = splitSentences(removeLabelLines(text2, !byLine), byLine)
    .map(cleanSentence)
    .filter((s) => /[\p{L}\p{N}]/u.test(s) && !isLabel(s)); // before dropRepeats, so labels can't hide repeats
  // labels filtered after truecasing, which can turn "Sicinius" into "SICINIUS"
  return truecase(dropRepeats(sentences)).filter((s) => !isLabel(s)).join('\n');
}
