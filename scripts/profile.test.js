import {analyse, neighbourAgreement} from './profile';

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
