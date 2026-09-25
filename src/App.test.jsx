import {render, screen, fireEvent} from '@testing-library/react';
import App from './App';

const button = (name) => screen.getByRole('button', {name});

test('lists every corpus in the selector', () => {
  render(<App />);
  const options = [...screen.getByLabelText('Corpus').options].map((o) => o.textContent);
  expect(options).toEqual([
    'BattleCreekDec19_2019', 'aesop', 'alice', 'grimm', 'gutenberg', 'pride-and-prejudice', 'proverbs',
    'sherlock-holmes', 'tiny-shakespeare', 'tinystories', 'trump', 'wikitext-2',
  ]);
});

test('generate is disabled until the chain is built, then appends paragraphs', async () => {
  const {container} = render(<App />);
  expect(button('generate').disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/proverbs.txt'}});
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '2'}});
  fireEvent.click(button('build'));

  const generate = await screen.findByRole('button', {name: 'generate'});
  await vi.waitFor(() => expect(generate.disabled).toBe(false));
  fireEvent.click(generate);
  fireEvent.click(generate);

  const paras = container.querySelectorAll('#console p');
  expect(paras).toHaveLength(2);
  expect(paras[0].querySelector('.badge').textContent).toBe('n=2');
  expect(paras[0].textContent.length).toBeGreaterThan('n=2 '.length);
});

test('clear removes generated text and badges show the n-grams each was built with', async () => {
  const {container} = render(<App />);
  expect(button('clear').disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/proverbs.txt'}});
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '1'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('generate').disabled).toBe(false));
  fireEvent.click(button('generate'));

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('generate').disabled).toBe(false));
  fireEvent.click(button('generate'));

  const badges = [...container.querySelectorAll('#console .badge')].map((b) => b.textContent);
  expect(badges).toEqual(['n=1', 'n=3']);

  fireEvent.click(button('clear'));
  expect(container.querySelectorAll('#console p')).toHaveLength(0);
  expect(button('clear').disabled).toBe(true);
});

test('changing settings after a build disables generate again', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/proverbs.txt'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('generate').disabled).toBe(false));

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  expect(button('generate').disabled).toBe(true);
});

test.each(['', '0', '11', '2.5', '-1'])('build is disabled for n-grams "%s"', (value) => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(true);
});

test.each(['1', '10'])('build is enabled for n-grams "%s"', (value) => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(false);
});

async function buildProverbs() {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/proverbs.txt'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('view').disabled).toBe(false));
}

function openView(option) {
  fireEvent.click(button('view'));
  fireEvent.click(screen.getByRole('menuitem', {name: option}));
}

test('view is disabled until the chain is built', () => {
  render(<App />);
  expect(button('view').disabled).toBe(true);
});

test('view is a dropdown offering graph and table', async () => {
  await buildProverbs();
  expect(screen.queryByRole('menu')).toBeNull();

  fireEvent.click(button('view'));
  const items = screen.getAllByRole('menuitem').map((b) => b.textContent);
  expect(items).toEqual(['graph', 'table']);
  expect(button('view').getAttribute('aria-expanded')).toBe('true');

  fireEvent.mouseDown(document.body); // click outside closes it
  expect(screen.queryByRole('menu')).toBeNull();

  fireEvent.click(button('view'));
  fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
  expect(screen.queryByRole('menu')).toBeNull();
});

test('view graph opens a word map; X and Escape close it', async () => {
  await buildProverbs();

  openView('graph');
  expect(screen.queryByRole('menu')).toBeNull();
  const dialog = await screen.findByRole('dialog', {name: 'Word map'});
  expect(dialog.querySelectorAll('svg text')).toHaveLength(300);
  expect(dialog.querySelectorAll('svg circle')).toHaveLength(0);

  fireEvent.click(button('close'));
  expect(screen.queryByRole('dialog')).toBeNull();

  openView('graph');
  fireEvent.keyDown(await screen.findByRole('dialog'), {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('view table lists words with their links and can be filtered', async () => {
  await buildProverbs();

  openView('table');
  const dialog = await screen.findByRole('dialog', {name: 'Chain table'});
  expect(dialog.querySelectorAll('tbody')).toHaveLength(300); // proverbs has more distinct words than that

  expect(dialog.querySelector('thead').textContent).toBe('contextnext wordcount%');
  fireEvent.change(screen.getByLabelText('filter contexts'), {target: {value: 'th'}});
  const contexts = [...dialog.querySelectorAll('tbody th')].map((th) => th.firstChild.textContent.trim());
  expect(contexts.length).toBeGreaterThan(0);
  expect(contexts.every((c) => c.toLowerCase().startsWith('th') && c.split(' ').length === 2)).toBe(true); // default order 2

  // only count and % are numeric: the first row of each word has an extra <th>, so position can't be used
  const firstRow = dialog.querySelector('tbody tr');
  expect([...firstRow.querySelectorAll('td')].map((td) => td.className)).toEqual(['', 'num', 'num']);
  const otherRow = dialog.querySelectorAll('tbody tr')[1];
  expect([...otherRow.querySelectorAll('td')].map((td) => td.className)).toEqual(['', 'num', 'num']);

  fireEvent.click(button('close'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('view shows the cleaned corpus text in a popup', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/BattleCreekDec19_2019.txt'}});
  fireEvent.click(button('view corpus'));

  const dialog = await screen.findByRole('dialog', {name: 'Corpus: BattleCreekDec19_2019'});
  const text = dialog.querySelector('pre').textContent;
  expect(text.startsWith('thank you\nthank you to Vice President Pence')).toBe(true);
  expect(text).not.toContain('"');

  fireEvent.click(button('close'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a spinner and status message show while blocking work runs', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: './corpus/proverbs.txt'}});
  fireEvent.click(button('build'));

  const status = screen.getByRole('status');
  expect(status.textContent).toContain('building chain');
  expect(status.querySelector('.spinner')).not.toBeNull();
  expect(button('build').disabled).toBe(true);
  expect(button('view corpus').disabled).toBe(true);

  await vi.waitFor(() => expect(button('view').disabled).toBe(false));
  expect(status.textContent).toBe('');
  expect(status.querySelector('.spinner')).toBeNull();

  openView('graph');
  expect(status.textContent).toContain('Drawing word map');
  await screen.findByRole('dialog', {name: 'Word map'});
  expect(status.textContent).toBe('');
});
