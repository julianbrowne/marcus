import {
  normaliseUnicode, stripGutenberg, detokenise, stripNonProse, removeLabelLines, linesAreSentences, splitSentences,
  cleanSentence, collapseRepeats, dropRepeats, truecase, clean,
} from './textprep';
import battleCreek from './corpus/BattleCreekDec19_2019.txt?raw';
import proverbs from './corpus/proverbs.txt?raw';

test('normaliseUnicode folds typography to plain ASCII forms', () => {
  expect(normaliseUnicode('“Hi” ‘there’… a—b a--b c​\r\nd\te'))
    .toBe('"Hi" \'there\'... a - b a - b c\nd e');
});

test('stripGutenberg keeps only the book and drops Project Gutenberg references', () => {
  const ebook = 'The Project Gutenberg eBook of X\nlicence\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nOnce upon a time.\nSee Project Gutenberg online.\nThe end.\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nmore licence';
  expect(stripGutenberg(ebook)).toBe('Once upon a time.\nThe end.');
  expect(stripGutenberg('plain text')).toBe('plain text');
  const two = `${ebook}\n\n${ebook.replace('Once upon a time.', 'Second book.')}`;
  expect(stripGutenberg(two)).toBe('Once upon a time.\nThe end.\n\nSecond book.\nThe end.');
});

test('detokenise undoes WikiText-style tokenisation', () => {
  expect(detokenise(' = = Gameplay = = \n The game \'s role @-@ playing system cost 1 @,@ 000 or 2 @.@ 5 , and we do n\'t know .'))
    .toBe('\n The game\'s role-playing system cost 1,000 or 2.5 , and we don\'t know .');
});

test('stripNonProse removes markup, links and transcript annotations', () => {
  expect(stripNonProse('<b>Hi</b> &amp; see https://x.com or a@b.com [applause] (inaudible) ok').replace(/\s+/g, ' '))
    .toBe(' Hi & see or ok');
});

test('removeLabelLines drops speaker labels and all-caps headings', () => {
  expect(removeLabelLines('THE GOLDEN BIRD\nFirst Citizen:\nBefore we proceed.\nUS jobs are up.'))
    .toBe('\n\nBefore we proceed.\nUS jobs are up.');
});

test('removeLabelLines with titles also drops headings, contents entries and bylines', () => {
  expect(removeLabelLines('The Wolf and the Lamb\nby Lewis Carroll\nThe wolf ate the lamb.\nIt was said,\nMerry Christmas Michigan', true))
    .toBe('\n\nThe wolf ate the lamb.\nIt was said,\n');
  expect(removeLabelLines('CHAPTER 26. Knights and Squires.\nChapter IV\nChapter after chapter he wrote on, far into the night and on into the next morning.', true))
    .toBe('\n\nChapter after chapter he wrote on, far into the night and on into the next morning.');
});

test('linesAreSentences tells one-per-line corpora from wrapped prose', () => {
  expect(linesAreSentences(proverbs)).toBe(true);
  expect(linesAreSentences('It was a dark\nand stormy night. The rain\nfell.')).toBe(false);
});

test('splitSentences segments prose, joins wrapped lines, respects abbreviations', () => {
  expect(splitSentences('Mr. Smith went to the U.S. office.\nIt was\nshut! Why? Nobody knows... Then home.'))
    .toEqual(['Mr Smith went to the US office.', 'It was shut!', 'Why?', 'Nobody knows...', 'Then home.']);
  expect(splitSentences('The king said, \'One feather is no use.\' He said: "Go." Then, "go" he said.'))
    .toEqual(['The king said,', '\'One feather is no use.\'', 'He said:', '"Go."', 'Then, "go" he said.']);
  expect(splitSentences('a cat may look at a king\na dog is a man\'s best friend', true))
    .toEqual(['a cat may look at a king', 'a dog is a man\'s best friend']);
});

test('cleanSentence strips punctuation and quotes but keeps meaningful symbols', () => {
  expect(cleanSentence('I said, "You\'re so lucky." He said, \'Darling!\''))
    .toBe("I said You're so lucky He said Darling");
  expect(cleanSentence('$45 million, up 97%; a $1.5 billion A+ deal with AT&T for African-Americans.'))
    .toBe('$45 million up 97% a $1.5 billion A+ deal with AT&T for African-Americans');
  expect(cleanSentence('I didn\'t say my campaign- I said, um, the - uh - thing')).toBe("I didn't say my campaign I said the thing");
  expect(cleanSentence("they ne'er cared o'er the hill")).toBe("they ne'er cared o'er the hill");
  expect(cleanSentence("a lady's 'Verily''s")).toBe("a lady's Verily's");
});

test('collapseRepeats removes stutters and is stable', () => {
  expect(collapseRepeats('by the way by the way by the way it is')).toBe('by the way it is');
  expect(collapseRepeats('no no no NO')).toBe('no');
  expect(collapseRepeats('more and more and more')).toBe(collapseRepeats(collapseRepeats('more and more and more')));
});

test('dropRepeats removes consecutive duplicate sentences only', () => {
  expect(dropRepeats(['thank you', 'Thank you', 'hi', 'thank you'])).toEqual(['thank you', 'hi', 'thank you']);
});

test('truecase lowercases sentence-initial words unless they are usually capitalised', () => {
  expect(truecase(['The Vice President came', 'Thank you', 'I love the US', 'Michigan wins', 'we won Michigan', 'US jobs']))
    .toEqual(['the Vice President came', 'thank you', 'I love the US', 'Michigan wins', 'we won Michigan', 'US jobs']);
});

describe('clean() on the raw BattleCreek speech', () => {
  const out = clean(battleCreek);
  const lines = out.split('\n');

  test('produces one clean sentence per line', () => {
    expect(lines.length).toBeGreaterThan(1000);
    expect(lines.every((l) => l === l.trim() && l.length > 0)).toBe(true);
    expect(out).not.toMatch(/["‘’“”…,;:!?]/);
    expect(out).not.toMatch(/\.(?!\d)/); // only decimal points remain
    expect(out).not.toMatch(/ {2}/);
  });

  test('keeps meaningful tokens', () => {
    for (const token of ['$45 million', '297%', 'African-American', 'A+', 'US auto industry', 'Vice President Pence', "I'm"]) {
      expect(out).toContain(token);
    }
  });

  test('removes transcript noise', () => {
    expect(lines.slice(0, 3)).toEqual(['thank you', 'thank you to Vice President Pence', "he's a good guy"]);
    expect(out).not.toMatch(/\bby the way by the way\b/i);
    expect(lines.some((l, i) => i > 0 && l.toLowerCase() === lines[i - 1].toLowerCase())).toBe(false);
  });

  test('is idempotent', () => {
    expect(clean(out)).toBe(out);
  });
});

test('clean() keeps one-sentence-per-line corpora line for line', () => {
  expect(clean(proverbs).split('\n').slice(0, 2)).toEqual(['a cat may look at a king', 'a chain is only as strong as its weakest link']);
});
