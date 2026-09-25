import {Markov} from './markov';
import {summarise} from './ChainTable';

test('summarise counts links per word, most frequent words and links first', () => {
  const m = new Markov('the cat sat\nthe cat ran\nthe dog sat\na cat sat\nmy cat sat');
  m.buildChain();
  const rows = summarise(m.chain);

  expect(rows[0]).toEqual({word: 'cat', total: 4, links: [{next: 'sat', count: 3}, {next: 'ran', count: 1}]});
  expect(rows.find((r) => r.word === 'the')).toEqual({
    word: 'the', total: 3, links: [{next: 'cat', count: 2}, {next: 'dog', count: 1}],
  });
});
