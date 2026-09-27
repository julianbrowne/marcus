import {analyse, neighbourAgreement, toneArc, distinctiveWords} from '../src/analyse';

test('analyse counts words, parts of speech, tone, entities and content words', () => {
  const {profile, posOf} = analyse('The happy cat sat on the mat. Elizabeth did not like it. She paid $10 on Monday.\n');
  expect(profile.words).toBeGreaterThan(15);
  expect(Object.keys(profile.partsOfSpeech)).toEqual(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'name', 'function word']);
  expect(Object.values(profile.partsOfSpeech).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
  expect(profile.sentiment.sentences).toBe(3);
  expect(profile.negatedPer1000).toBeGreaterThan(0); // "did not like"
  expect(profile.entities.map((e) => e.type)).toEqual(expect.arrayContaining(['MONEY', 'DATE']));
  expect(profile.topWords.map((w) => w.word)).toEqual(expect.arrayContaining(['cat', 'Elizabeth']));
  expect(profile.readability.flesch).toBeGreaterThan(50);
  expect(posOf.get('cat')).toBe('noun');
  expect(posOf.get('sat')).toBe('verb');
  expect(posOf.get('she')).toBe('pronoun');
});

test('analyse gives the same counts in one piece or in chunks', () => {
  const para = 'The fox ran into the wood. It was not happy.\n\n';
  const small = analyse(para.repeat(10)).profile;
  const big = analyse(para.repeat(30000)).profile; // > 1MB, so analysed in chunks
  expect(big.words).toBe(small.words * 3000);
  expect(big.partsOfSpeech).toEqual(small.partsOfSpeech);
  expect(big.sentiment.sentences).toBe(small.sentiment.sentences * 3000);
});

test('analyse with byLine treats each unpunctuated line as a sentence', () => {
  const lines = 'a cat may look at a king\na friend in need is a friend indeed\nall is well that ends well\n';
  expect(analyse(lines).profile.sentiment.sentences).toBe(1); // wink alone: one long sentence
  const {profile} = analyse(lines, true);
  expect(profile.sentiment.sentences).toBe(3);
  expect(profile.readability.flesch).toBeGreaterThan(60);
});

test('neighbourAgreement compares neighbours sharing a part of speech with chance', () => {
  // nouns clustered at x=0, verbs at x=10: every neighbour agrees; chance is ~half
  const points = [
    ...Array.from({length: 6}, (_, i) => ({word: `n${i}`, x: 0, y: i, pos: 'noun'})),
    ...Array.from({length: 6}, (_, i) => ({word: `v${i}`, x: 10, y: i, pos: 'verb'})),
  ];
  expect(neighbourAgreement(points)).toEqual({neighbours: 5, sharePct: 100, chancePct: 45.5});
});

test('toneArc averages sentence tone in equal slices from start to finish', () => {
  expect(toneArc([1, 1, -1, -1], 2)).toEqual([1, -1]);
  expect(toneArc([0.5, 0.1, 0.3], 40)).toEqual([0.5, 0.1, 0.3]); // never more slices than sentences
  expect(toneArc([])).toEqual([]);
});

test('analyse reports key sentences a reader can take in, and the tone arc', () => {
  const text = 'The fox was happy in the green wood all day long and sang. '.repeat(3) +
    'Short one. ' + 'The wolf was sad and cold and hungry in the dark wood at night. '.repeat(3);
  const {profile, contentWords} = analyse(text);
  expect(profile.keySentences.length).toBeGreaterThan(0);
  for (const s of profile.keySentences) expect(s.split(' ').length).toBeGreaterThanOrEqual(8);
  expect(profile.toneArc.length).toBe(profile.sentiment.sentences);
  expect(profile.toneArc[0]).toBeGreaterThan(0); // happy fox first
  expect(profile.toneArc.at(-1)).toBeLessThan(0); // sad wolf last
  expect(contentWords.get('fox')).toBe(3);
});

test('distinctiveWords picks words that set a corpus apart, merging case', () => {
  const counts = new Map([
    ['fables', new Map([['Fox', 30], ['fox', 10], ['day', 50], ['wood', 40]])],
    ['novel', new Map([['Elizabeth', 40], ['day', 50], ['letter', 30]])],
    ['sea', new Map([['whale', 60], ['day', 50], ['ship', 20]])],
  ]);
  const words = distinctiveWords(counts, 2);
  expect(words.get('fables')).toEqual(['Fox', 'wood']); // "Fox" + "fox" merged, shown in the commoner form
  expect(words.get('novel')).toEqual(['Elizabeth', 'letter']);
  expect(words.get('sea')).toEqual(['whale', 'ship']);
  for (const list of words.values()) expect(list).not.toContain('day'); // everywhere, so not distinctive
});
