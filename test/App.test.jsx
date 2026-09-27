import {render, screen, fireEvent} from '@testing-library/react';
import App from '../src/App';

const button = (name) => screen.getByRole('button', {name});
const selectCorpus = (name) => fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: name}});

test('starts with no corpus selected, a blank main pane and nothing to build or view', () => {
  const {container} = render(<App />);
  const select = screen.getByLabelText('Corpus');
  expect(select.value).toBe('');
  expect(select.selectedOptions[0].textContent).toBe('select a corpus');
  expect(select.options[0].disabled).toBe(true); // can't go back to "no corpus"
  expect(container.querySelector('main').children).toHaveLength(0);
  expect(button('build').disabled).toBe(true);
  expect(button('view corpus').disabled).toBe(true);

  selectCorpus('proverbs');
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('proverbs');
  expect(button('build').disabled).toBe(false);
  expect(button('view corpus').disabled).toBe(false);
});

test('lists every corpus in the selector', () => {
  render(<App />);
  const options = [...screen.getByLabelText('Corpus').options].map((o) => o.textContent);
  expect(options).toEqual([
    'select a corpus', 'BattleCreekDec19_2019', 'aesop', 'alice', 'grimm', 'gutenberg', 'pride-and-prejudice', 'proverbs',
    'sherlock-holmes', 'tiny-shakespeare', 'tinystories', 'trump', 'wikitext-2',
  ]);
});

test('generate is disabled until the chain is built, then appends paragraphs', async () => {
  const {container} = render(<App />);
  selectCorpus('proverbs');
  expect(button('generate').disabled).toBe(true);

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
  selectCorpus('proverbs');
  expect(button('clear').disabled).toBe(true);

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
  expect(container.querySelector('#console .empty').textContent).toBe('Nothing generated yet.');
  expect(button('clear').disabled).toBe(true);
});

test('changing settings after a build disables generate again', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'proverbs'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('generate').disabled).toBe(false));

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  expect(button('generate').disabled).toBe(true);
});

test.each(['', '0', '11', '2.5', '-1'])('build is disabled for n-grams "%s"', (value) => {
  render(<App />);
  selectCorpus('proverbs');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(true);
});

test.each(['1', '10'])('build is enabled for n-grams "%s"', (value) => {
  render(<App />);
  selectCorpus('proverbs');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(false);
});

async function buildProverbs() {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'proverbs'}});
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('view').disabled).toBe(false));
}

function openView(option, menu = 'view') {
  fireEvent.click(button(menu));
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
  const dialog = await screen.findByRole('dialog', {name: 'Word map: proverbs'});
  expect(dialog.querySelectorAll('svg text')).toHaveLength(300);
  // each word has a marker coloured by its part of speech, with a legend
  expect(dialog.querySelectorAll('svg circle')).toHaveLength(300);
  expect(dialog.querySelector('.hint').textContent).toMatch(/share its part of speech \d+(\.\d)?% of the time/);
  const legend = [...dialog.querySelectorAll('.legend button')];
  expect(legend.map((b) => b.firstChild.nextSibling.textContent.trim())).toContain('noun');

  // clicking a legend entry highlights that part of speech
  const noun = legend.find((b) => b.textContent.startsWith('noun'));
  fireEvent.click(noun);
  expect(noun.getAttribute('aria-pressed')).toBe('true');
  const faded = [...dialog.querySelectorAll('svg g')].filter((g) => g.getAttribute('opacity') === '0.15');
  expect(faded.length).toBeGreaterThan(0);
  expect(faded.every((g) => !g.querySelector('title').textContent.endsWith(': noun'))).toBe(true);

  fireEvent.click(button('close'));
  expect(screen.queryByRole('dialog')).toBeNull();

  openView('graph');
  fireEvent.keyDown(await screen.findByRole('dialog'), {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('view table lists words with their links and can be filtered', async () => {
  await buildProverbs();

  openView('table');
  const dialog = await screen.findByRole('dialog', {name: 'Chain table: proverbs'});
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

test('view corpus offers raw, clean and profile, available before any build', () => {
  render(<App />);
  selectCorpus('proverbs');
  expect(button('view corpus').disabled).toBe(false);
  fireEvent.click(button('view corpus'));
  expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['raw', 'clean', 'profile']);
});

test('raw and clean views show the source and the cleaned text', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'BattleCreekDec19_2019'}});

  openView('raw', 'view corpus');
  let dialog = await screen.findByRole('dialog', {name: 'Raw text: BattleCreekDec19_2019'});
  expect(dialog.querySelector('pre').textContent.startsWith('Thank you. Thank you. Thank you to Vice President Pence.')).toBe(true);
  fireEvent.click(button('close'));

  openView('clean', 'view corpus');
  dialog = await screen.findByRole('dialog', {name: 'Clean text: BattleCreekDec19_2019'});
  const text = dialog.querySelector('pre').textContent;
  expect(text.startsWith('thank you\nthank you to Vice President Pence')).toBe(true);
  expect(text).not.toContain('"');
  fireEvent.click(button('close'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('big corpora show only the start of their text', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'tinystories'}});
  openView('raw', 'view corpus');
  const dialog = await screen.findByRole('dialog', {name: 'Raw text: tinystories'});
  expect(dialog.querySelector('pre').textContent).toHaveLength(1_000_000);
  expect(dialog.querySelector('.hint').textContent).toMatch(/Showing the first 1,000,000 of 3,\d{3},\d{3} characters/);
});

test('profile shows size, readability, parts of speech, tone and common words', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'pride-and-prejudice'}});
  openView('profile', 'view corpus');
  const dialog = await screen.findByRole('dialog', {name: 'Profile: pride-and-prejudice'});
  const text = dialog.textContent;
  for (const heading of ['Size', 'Readability', 'Parts of speech', 'Tone', 'Most common content words']) expect(text).toContain(heading);
  expect(text).toMatch(/Flesch reading ease\d+ \(/);
  expect(text).toContain('Elizabeth');
  expect(dialog.querySelectorAll('.bars tr')).toHaveLength(7);
});

test('a spinner and status message show while blocking work runs', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'proverbs'}});
  fireEvent.click(button('build'));

  const status = screen.getByRole('status');
  expect(status.textContent).toContain('Building chain');
  expect(status.querySelector('.spinner')).not.toBeNull();
  expect(button('build').disabled).toBe(true);
  expect(button('view corpus').disabled).toBe(true);

  await vi.waitFor(() => expect(button('view').disabled).toBe(false));
  expect(status.textContent).toBe('');
  expect(status.querySelector('.spinner')).toBeNull();

  openView('graph');
  expect(status.textContent).toContain('Loading word map');
  await screen.findByRole('dialog', {name: 'Word map: proverbs'});
  expect(status.textContent).toBe('');
});

test('the selected corpus shows its headline figures from the build-time profile', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: 'pride-and-prejudice'}});
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('pride-and-prejudice');
  const stats = await screen.findAllByText(/^(Words|Sentences|Reading ease|Tone)$/);
  expect(stats.map((s) => s.textContent)).toEqual(['Words', 'Sentences', 'Reading ease', 'Tone']);
  expect(stats[2].nextSibling.textContent).toMatch(/^\d+$/); // Flesch score
});

test('the sidebar links to the test report, above the source link', () => {
  const {container} = render(<App />);
  const links = [...container.querySelectorAll('.sidebar-footer a')];
  expect(links.map((a) => a.textContent.trim())).toEqual(['Test report', 'Source on GitHub']);
  expect(links[0].getAttribute('href')).toBe('./tests/index.html'); // relative, so it works under /marcus/ on Pages
  expect(links[0].getAttribute('target')).toBe('_blank');
});
