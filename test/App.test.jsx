import {render, screen, fireEvent, within} from '@testing-library/react';
import App from '../src/App';

const button = (name) => screen.getByRole('button', {name});
// picking a corpus loads its profile (with the spinner); wait until that's done
const pickCorpus = (name) => fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: name}});
const selectCorpus = async (name) => {
  pickCorpus(name);
  await vi.waitFor(() => expect(screen.getByLabelText('Corpus').disabled).toBe(false));
};

// the multi-part view buttons: "view corpus" (raw | clean | profile) and "view chain" (graph | table)
const parts = (group) => within(screen.getByRole('group', {name: group})).getAllByRole('button');
const part = (option) => {
  const group = ['raw', 'clean', 'profile'].includes(option) ? 'view corpus' : 'view chain';
  return within(screen.getByRole('group', {name: group})).getByRole('button', {name: option});
};
const openView = (option) => fireEvent.click(part(option));
// views open in the main pane as a region named after the view
const findView = (title) => screen.findByRole('region', {name: title});
const home = () => document.querySelector('#console');

test('starts with no corpus selected, a blank main pane and nothing to build or view', async () => {
  const {container} = render(<App />);
  const select = screen.getByLabelText('Corpus');
  expect(select.value).toBe('');
  expect(select.selectedOptions[0].textContent).toBe('select a corpus');
  expect(select.options[0].disabled).toBe(true); // can't go back to "no corpus"
  expect(container.querySelector('main').children).toHaveLength(0);
  expect(button('build').disabled).toBe(true);
  expect(parts('view corpus').every((b) => b.disabled)).toBe(true);

  await selectCorpus('proverbs');
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('proverbs');
  expect(button('build').disabled).toBe(false);
  expect(parts('view corpus').every((b) => !b.disabled)).toBe(true);
});

test('the sidebar has corpus and chain sections, divided, with generate and clear in the chain section', () => {
  const {container} = render(<App />);
  const [corpusSection, chainSection] = container.querySelectorAll('.sidebar .group');
  expect(corpusSection.querySelector('.group-label').textContent).toBe('Corpus');
  expect(chainSection.querySelector('.group-label').textContent).toBe('Chain');
  expect(chainSection.classList.contains('divided')).toBe(true);
  const chainButtons = [...chainSection.querySelectorAll('button')].map((b) => b.textContent.trim());
  expect(chainButtons).toEqual(['build', 'graph', 'table', 'generate', 'clear']);
  expect(parts('view corpus').map((b) => b.textContent)).toEqual(['raw', 'clean', 'profile']);
  expect(parts('view chain').map((b) => b.textContent)).toEqual(['graph', 'table']);
});

test('lists every corpus in the selector', () => {
  render(<App />);
  const options = [...screen.getByLabelText('Corpus').options].map((o) => o.textContent);
  expect(options).toEqual([
    'select a corpus', 'BattleCreekDec19_2019', 'aesop', 'alice', 'grimm', 'gutenberg-67-books', 'moby-dick', 'pride-and-prejudice', 'proverbs',
    'sherlock-holmes', 'tiny-shakespeare', 'tinystories', 'trump-speeches', 'wikitext-2',
  ]);
});

test('generate is disabled until the chain is built, then appends paragraphs', async () => {
  const {container} = render(<App />);
  await selectCorpus('proverbs');
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
  await selectCorpus('proverbs');
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
  await selectCorpus('proverbs');
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(button('generate').disabled).toBe(false));

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  expect(button('generate').disabled).toBe(true);
});

test.each(['', '0', '11', '2.5', '-1'])('build is disabled for n-grams "%s"', async (value) => {
  render(<App />);
  await selectCorpus('proverbs');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(true);
});

test.each(['1', '10'])('build is enabled for n-grams "%s"', async (value) => {
  render(<App />);
  await selectCorpus('proverbs');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value}});
  expect(button('build').disabled).toBe(false);
});

async function buildProverbs() {
  render(<App />);
  await selectCorpus('proverbs');
  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(part('graph').disabled).toBe(false));
}

test('graph and table are disabled until the chain is built', async () => {
  render(<App />);
  await selectCorpus('proverbs');
  expect(parts('view chain').every((b) => b.disabled)).toBe(true);
});

test('a view replaces the headline figures and generated text; its button shows pressed, and pressing it again goes back', async () => {
  await buildProverbs();
  expect(await screen.findByText('Reading ease')).toBeTruthy();
  expect(home()).not.toBeNull();

  openView('table');
  await findView('Chain table');
  expect(part('table').getAttribute('aria-pressed')).toBe('true');
  expect(part('graph').getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByText('Reading ease')).toBeNull();
  expect(home()).toBeNull();

  openView('graph'); // switching views
  await findView('Word map');
  expect(part('graph').getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('region', {name: 'Chain table'})).toBeNull();

  fireEvent.click(part('graph')); // pressed again: back to the generated text
  expect(screen.queryByRole('region', {name: 'Word map'})).toBeNull();
  expect(home()).not.toBeNull();
  expect(screen.getByText('Reading ease')).toBeTruthy();
});

test('graph shows the word map in the main pane; X goes back to the generated text', async () => {
  await buildProverbs();

  openView('graph');
  const view = await findView('Word map');
  expect(view.closest('main')).not.toBeNull();
  expect(view.querySelector('.scroll svg')).not.toBeNull(); // scrolls within the pane
  expect(view.querySelectorAll('svg text')).toHaveLength(300);
  // each word has a marker coloured by its part of speech, with a legend
  expect(view.querySelectorAll('svg circle')).toHaveLength(300);
  expect(view.querySelector('.hint').textContent).toMatch(/share its part of speech \d+(\.\d)?% of the time/);
  const legend = [...view.querySelectorAll('.legend button')];
  expect(legend.map((b) => b.firstChild.nextSibling.textContent.trim())).toContain('noun');

  // clicking a legend entry highlights that part of speech
  const noun = legend.find((b) => b.textContent.startsWith('noun'));
  fireEvent.click(noun);
  expect(noun.getAttribute('aria-pressed')).toBe('true');
  const faded = [...view.querySelectorAll('svg g')].filter((g) => g.getAttribute('opacity') === '0.15');
  expect(faded.length).toBeGreaterThan(0);
  expect(faded.every((g) => !g.querySelector('title').textContent.endsWith(': noun'))).toBe(true);

  fireEvent.click(button('close'));
  expect(screen.queryByRole('region', {name: 'Word map'})).toBeNull();
  expect(home()).not.toBeNull();
});

test('table lists contexts with their next words and can be filtered', async () => {
  await buildProverbs();

  openView('table');
  const view = await findView('Chain table');
  expect(view.querySelectorAll('tbody')).toHaveLength(300); // proverbs has more distinct contexts than that

  expect(view.querySelector('thead').textContent).toBe('contextnext wordcount%');
  fireEvent.change(screen.getByLabelText('filter contexts'), {target: {value: 'th'}});
  const contexts = [...view.querySelectorAll('tbody th')].map((th) => th.firstChild.textContent.trim());
  expect(contexts.length).toBeGreaterThan(0);
  expect(contexts.every((c) => c.toLowerCase().startsWith('th') && c.split(' ').length === 2)).toBe(true); // default order 2

  // only count and % are numeric: the first row of each context has an extra <th>, so position can't be used
  const firstRow = view.querySelector('tbody tr');
  expect([...firstRow.querySelectorAll('td')].map((td) => td.className)).toEqual(['', 'num', 'num']);
  const otherRow = view.querySelectorAll('tbody tr')[1];
  expect([...otherRow.querySelectorAll('td')].map((td) => td.className)).toEqual(['', 'num', 'num']);

  fireEvent.click(button('close'));
  expect(screen.queryByRole('region', {name: 'Chain table'})).toBeNull();
});

test('generate goes back to the generated text if a view is open', async () => {
  await buildProverbs();
  openView('table');
  await findView('Chain table');
  fireEvent.click(button('generate'));
  expect(screen.queryByRole('region', {name: 'Chain table'})).toBeNull();
  expect(home().querySelectorAll('p')).toHaveLength(1);
});

test('changing the corpus closes any view; changing n closes only the table', async () => {
  await buildProverbs();
  openView('graph');
  await findView('Word map');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  expect(screen.getByRole('region', {name: 'Word map'})).toBeTruthy(); // the map doesn't depend on n

  fireEvent.click(button('build'));
  await vi.waitFor(() => expect(part('table').disabled).toBe(false));
  openView('table');
  await findView('Chain table');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '2'}});
  expect(screen.queryByRole('region', {name: 'Chain table'})).toBeNull(); // stale: it showed the n=3 chain

  openView('profile');
  await findView('Profile');
  await selectCorpus('aesop');
  expect(screen.queryByRole('region', {name: 'Profile'})).toBeNull();
});

test('raw, clean and profile are available before any build', async () => {
  render(<App />);
  await selectCorpus('proverbs');
  expect(parts('view corpus').every((b) => !b.disabled)).toBe(true);
});

test('raw and clean views show the source and the cleaned text', async () => {
  render(<App />);
  await selectCorpus('BattleCreekDec19_2019');

  openView('raw');
  let view = await findView('Raw text');
  expect(view.querySelector('pre').textContent.startsWith('Thank you. Thank you. Thank you to Vice President Pence.')).toBe(true);
  expect(view.querySelector('.scroll pre')).not.toBeNull();

  openView('clean');
  view = await findView('Clean text');
  const text = view.querySelector('pre').textContent;
  expect(text.startsWith('thank you\nthank you to Vice President Pence')).toBe(true);
  expect(text).not.toContain('"');
  fireEvent.click(button('close'));
  expect(screen.queryByRole('region', {name: 'Clean text'})).toBeNull();
});

test('big corpora show only the start of their text', async () => {
  render(<App />);
  await selectCorpus('tinystories');
  openView('raw');
  const view = await findView('Raw text');
  expect(view.querySelector('pre').textContent).toHaveLength(1_000_000);
  expect(view.querySelector('.hint').textContent).toMatch(/Showing the first 1,000,000 of 3,\d{3},\d{3} characters/);
});

test('profile shows size, readability, parts of speech, tone and common words', async () => {
  render(<App />);
  await selectCorpus('pride-and-prejudice');
  openView('profile');
  const view = await findView('Profile');
  const text = view.textContent;
  for (const heading of ['Size', 'Readability', 'Parts of speech', 'Tone', 'Most common content words']) expect(text).toContain(heading);
  expect(text).toMatch(/Flesch reading ease\d+ \(/);
  expect(text).toContain('Elizabeth');
  expect(view.querySelectorAll('.bars tr')).toHaveLength(7);
});

test('a spinner and status message show while blocking work runs', async () => {
  render(<App />);
  await selectCorpus('proverbs');
  fireEvent.click(button('build'));

  const status = screen.getByRole('status');
  expect(status.textContent).toContain('Building chain');
  expect(status.querySelector('.spinner')).not.toBeNull();
  expect(button('build').disabled).toBe(true);
  expect(parts('view corpus').every((b) => b.disabled)).toBe(true);

  await vi.waitFor(() => expect(part('graph').disabled).toBe(false));
  expect(status.textContent).toBe('');
  expect(status.querySelector('.spinner')).toBeNull();

  openView('graph');
  expect(status.textContent).toContain('Loading word map');
  await findView('Word map');
  expect(status.textContent).toBe('');
});

test('selecting a corpus shows a spinner until its figures load, with controls disabled meanwhile', async () => {
  render(<App />);
  pickCorpus('gutenberg-67-books');
  const status = screen.getByRole('status');
  expect(status.textContent).toContain('Loading corpus');
  expect(status.querySelector('.spinner')).not.toBeNull();
  expect(screen.getByLabelText('Corpus').disabled).toBe(true);
  expect(button('build').disabled).toBe(true);

  await screen.findByText('Reading ease');
  expect(status.textContent).toBe('');
  expect(screen.getByLabelText('Corpus').disabled).toBe(false);
  expect(button('build').disabled).toBe(false);
});

test('the selected corpus shows its headline figures from the build-time profile', async () => {
  render(<App />);
  await selectCorpus('pride-and-prejudice');
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
