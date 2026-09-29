// These tests drive the real app, so they read the real corpora in src/corpus. They name
// only proverbs and pride-and-prejudice (small, stable) and otherwise derive what they
// expect from the files present, so corpora can be added, edited or removed freely.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {render, screen, fireEvent, within, waitFor} from '@testing-library/react';
import App from '../src/App';

// tests run from the project root (plain paths: Vite rewrites new URL(..., import.meta.url))
const corpusFile = (kind, name) => `src/corpus/${kind}/${name}.txt`;
const RAW_NAMES = readdirSync('src/corpus/raw').filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
const corpusText = (kind, name) => readFileSync(corpusFile(kind, name), 'utf8');

const button = (name) => screen.getByRole('button', {name});
// picking a corpus loads its profile (with the spinner); wait until that's done
const pickCorpus = (name) => fireEvent.change(screen.getByLabelText('Corpus'), {target: {value: name}});
const selectCorpus = async (name) => {
  pickCorpus(name);
  await waitFor(() => expect(screen.getByLabelText('Corpus').disabled).toBe(false));
};

// the multi-part view buttons: "view corpus" (raw | clean | profile) and "view chain" (graph | table)
const parts = (group) => within(screen.getByRole('group', {name: group})).getAllByRole('button');
const part = (option) => {
  const group = ['raw', 'clean', 'profile', 'ask'].includes(option) ? 'view corpus' : 'view chain';
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

test('the call to action moves from build (once a corpus is chosen) to generate (once built)', async () => {
  render(<App />);
  const isCta = (name) => button(name).classList.contains('cta');
  // nothing chosen: every button disabled, none styled as the call to action's enabled look
  expect([...document.querySelectorAll('.sidebar button')].every((b) => b.disabled)).toBe(true);

  await selectCorpus('proverbs');
  expect(isCta('build')).toBe(true);
  expect(isCta('generate')).toBe(false);
  expect(parts('view corpus').every((b) => !b.disabled)).toBe(true);
  expect(parts('view chain').every((b) => b.disabled)).toBe(true);

  fireEvent.click(button('build'));
  await waitFor(() => expect(button('generate').disabled).toBe(false));
  expect(isCta('build')).toBe(false);
  expect(isCta('generate')).toBe(true);
  expect(parts('view chain').every((b) => !b.disabled)).toBe(true);
});

test('the sidebar has corpus and chain sections, divided, with generate and clear in the chain section', () => {
  const {container} = render(<App />);
  const [corpusSection, chainSection] = container.querySelectorAll('.sidebar .group');
  expect(corpusSection.querySelector('.group-label').textContent).toBe('Corpus');
  expect(chainSection.querySelector('.group-label').textContent).toBe('Chain');
  expect(chainSection.classList.contains('divided')).toBe(true);
  const chainButtons = [...chainSection.querySelectorAll('button')].map((b) => b.textContent.trim());
  expect(chainButtons).toEqual(['build', 'graph', 'table', 'navigate', 'generate', 'clear']);
  expect(parts('view corpus').map((b) => b.textContent)).toEqual(['raw', 'clean', 'profile', 'ask']);
  expect(parts('view chain').map((b) => b.textContent)).toEqual(['graph', 'table', 'navigate']);
});

test('lists every corpus in the selector', () => {
  render(<App />);
  const options = [...screen.getByLabelText('Corpus').options].map((o) => o.textContent);
  expect(options[0]).toBe('select a corpus');
  expect([...options.slice(1)].sort()).toEqual(RAW_NAMES); // one entry per file in src/corpus/raw
});

test('generate is disabled until the chain is built, then appends paragraphs', async () => {
  const {container} = render(<App />);
  await selectCorpus('proverbs');
  expect(button('generate').disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '2'}});
  fireEvent.click(button('build'));

  const generate = await screen.findByRole('button', {name: 'generate'});
  await waitFor(() => expect(generate.disabled).toBe(false));
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
  await waitFor(() => expect(button('generate').disabled).toBe(false));
  fireEvent.click(button('generate'));

  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '3'}});
  fireEvent.click(button('build'));
  await waitFor(() => expect(button('generate').disabled).toBe(false));
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
  await waitFor(() => expect(button('generate').disabled).toBe(false));

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
  await waitFor(() => expect(part('graph').disabled).toBe(false));
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
  expect(view.querySelectorAll('svg text')).toHaveLength(500);
  // each word has a marker coloured by its part of speech, with a legend
  expect(view.querySelectorAll('svg circle')).toHaveLength(500);
  expect(view.querySelector('.hint').textContent).toMatch(/share its part of speech \d+(\.\d)?% of the time/);
  const legend = [...view.querySelectorAll('.legend button')];
  expect(legend.map((b) => b.firstChild.nextSibling.textContent.trim())).toContain('noun');

  // every word sits clear of the canvas edges, with room for its label on the right
  const svg = view.querySelector('.scroll svg');
  const [width, height] = [Number(svg.getAttribute('width')), Number(svg.getAttribute('height'))];
  for (const g of view.querySelectorAll('svg g')) {
    const [x, y] = g.getAttribute('transform').match(/[\d.]+/g).map(Number);
    const word = g.querySelector('text').textContent;
    expect(x).toBeGreaterThanOrEqual(24 + 7); // margin + dot
    expect(y).toBeGreaterThanOrEqual(24 + 11); // margin + half a line
    expect(y).toBeLessThanOrEqual(height - 24 - 11);
    expect(x + 12 + word.length * 22 * 0.65).toBeLessThanOrEqual(width - 24 + 0.001); // label fits
  }

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
  expect(view.querySelectorAll('tbody')).toHaveLength(500); // proverbs has more distinct contexts than that

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
  await waitFor(() => expect(part('table').disabled).toBe(false));
  openView('table');
  await findView('Chain table');
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '2'}});
  expect(screen.queryByRole('region', {name: 'Chain table'})).toBeNull(); // stale: it showed the n=3 chain

  openView('profile');
  await findView('Profile');
  await selectCorpus('pride-and-prejudice');
  expect(screen.queryByRole('region', {name: 'Profile'})).toBeNull();
});

test('raw, clean and profile are available before any build', async () => {
  render(<App />);
  await selectCorpus('proverbs');
  expect(parts('view corpus').every((b) => !b.disabled)).toBe(true);
});

test('raw and clean views show the source file and the cleaned text', async () => {
  render(<App />);
  await selectCorpus('proverbs');

  openView('raw');
  let view = await findView('Raw text');
  expect(view.querySelector('.scroll pre').textContent).toBe(corpusText('raw', 'proverbs'));

  openView('clean');
  view = await findView('Clean text');
  expect(view.querySelector('pre').textContent).toBe(corpusText('clean', 'proverbs'));
  expect(view.querySelector('pre').textContent).not.toMatch(/[".,;!?]/); // what the cleaner guarantees
  fireEvent.click(button('close'));
  expect(screen.queryByRole('region', {name: 'Clean text'})).toBeNull();
});

test('big corpora show only the start of their text', async () => {
  // the smallest corpus over the display limit: same check, far less to load than the biggest
  const big = RAW_NAMES.map((name) => [name, statSync(corpusFile('raw', name)).size])
    .filter(([, size]) => size > 1_100_000).sort((a, b) => a[1] - b[1])[0]?.[0];
  expect(big).toBeTruthy(); // at least one corpus is over the display limit
  render(<App />);
  await selectCorpus(big);
  openView('raw');
  const view = await findView('Raw text');
  expect(view.querySelector('pre').textContent).toHaveLength(1_000_000);
  expect(view.querySelector('.hint').textContent).toMatch(/Showing the first 1,000,000 of [\d,]+ characters/);
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
  // distinctive words, the tone arc and key sentences, all computed at build time
  for (const heading of ['Distinctive words', 'Tone across the text', 'Key sentences']) expect(text).toContain(heading);
  expect(text).toMatch(/Distinctive words[^]*Darcy/);
  expect(view.querySelectorAll('.tone-arc rect').length).toBeGreaterThan(10);
  expect(view.querySelector('.tone-arc rect title').textContent).toMatch(/^0–\d+% through: (positive|negative|neutral)/);
  expect(view.querySelectorAll('.key-sentences li').length).toBeGreaterThan(0);
});

test('analyse compares generated text with its corpus, one column per context length', async () => {
  await buildProverbs();
  expect(button('analyse').disabled).toBe(true); // nothing generated yet

  fireEvent.click(button('generate'));
  fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: '1'}});
  fireEvent.click(button('build'));
  await waitFor(() => expect(button('generate').disabled).toBe(false));
  fireEvent.click(button('generate'));
  fireEvent.click(button('generate'));

  fireEvent.click(button('analyse'));
  const view = await findView('Generated text analysis');
  const headings = [...view.querySelectorAll('thead th')].map((th) => th.textContent);
  expect(headings).toEqual(['measure', 'corpus', 'n=1 (2 paras)', 'n=2 (1 para)']);
  const rows = [...view.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
  expect(rows[0][0]).toBe('Sentences analysed'); // so the sample size is visible
  expect(rows.map((r) => r[0])).toEqual(expect.arrayContaining(['Words per sentence', 'Reading ease (Flesch)', 'noun', 'Positive sentences']));
  for (const row of rows) expect(row).toHaveLength(4);
  const flesch = rows.find((r) => r[0] === 'Reading ease (Flesch)');
  expect(flesch.slice(1).every((v) => /^-?\d+$/.test(v))).toBe(true);
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

  await waitFor(() => expect(part('graph').disabled).toBe(false));
  expect(status.textContent).toBe('');
  expect(status.querySelector('.spinner')).toBeNull();

  openView('graph');
  expect(status.textContent).toContain('Loading word map');
  await findView('Word map');
  expect(status.textContent).toBe('');
});

test('selecting a corpus shows a spinner until its figures load, with controls disabled meanwhile', async () => {
  render(<App />);
  pickCorpus('pride-and-prejudice');
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

test('navigate walks the chain by hand from a start word to the end of a sentence', async () => {
  await buildProverbs(); // n = 2
  openView('navigate');
  const view = await findView('Navigate the chain');
  const chips = () => [...view.querySelectorAll('.chips-area .chip')];

  // start: sentence starters, filtered by what's typed
  expect(chips().length).toBeGreaterThan(50);
  fireEvent.change(screen.getByLabelText('starting words'), {target: {value: 'wh'}});
  expect(chips().every((c) => c.textContent.toLowerCase().startsWith('wh'))).toBe(true);
  fireEvent.change(screen.getByLabelText('starting words'), {target: {value: 'a'}});
  fireEvent.click(chips().find((c) => c.textContent.startsWith('a ')));

  // then: words that followed the context, each with its share
  const sentence = () => screen.getByLabelText('sentence so far');
  expect(sentence().textContent).toBe('a');
  expect(chips().length).toBeGreaterThan(1);
  expect(chips().every((c) => /\d+(\.\d)?%$/.test(c.textContent))).toBe(true);

  // keep taking the first option; the last n words are highlighted as the context
  for (let i = 0; i < 40 && !view.querySelector('.chip.end'); i++) fireEvent.click(chips()[0]);
  expect(view.querySelector('.chip.end')).not.toBeNull();
  const words = sentence().textContent.split(' ');
  expect(sentence().querySelectorAll('.context')).toHaveLength(Math.min(2, words.length));
  expect([...sentence().querySelectorAll('.context')].map((c) => c.textContent)).toEqual(words.slice(-2));

  const before = sentence().textContent;
  fireEvent.click(button('back'));
  expect(sentence().textContent.length).toBeLessThan(before.length);
  fireEvent.click(chips()[0]);

  // end of sentence finishes it
  for (let i = 0; i < 40 && !view.querySelector('.chip.end'); i++) fireEvent.click(chips()[0]);
  fireEvent.click(view.querySelector('.chip.end'));
  expect(sentence().textContent.endsWith('.')).toBe(true);
  expect(view.textContent).toContain('The sentence ends here');

  // start again, this time from typed words mid-sentence
  fireEvent.click(button('start again'));
  fireEvent.change(screen.getByLabelText('starting words'), {target: {value: 'the early'}});
  fireEvent.click(view.querySelector('.chip.phrase'));
  expect(sentence().textContent).toBe('the early');
  expect(chips().map((c) => c.textContent)).toContain('bird 100%'); // the early bird catches the worm
});

test('ask retrieves the nearest words to a question and to an analogy, and maps them', async () => {
  render(<App />);
  await selectCorpus('pride-and-prejudice');
  openView('ask');
  const view = await findView('Ask a question');
  expect(view.querySelector('.caption').textContent).toMatch(/similarity retrieval over word co-occurrence, not how an LLM generates an answer/);
  expect(view.querySelectorAll('.space-map .word-dot')).toHaveLength(2000); // every word in the space
  expect(view.querySelector('.space-map .query')).toBeNull(); // nothing asked yet

  fireEvent.change(screen.getByLabelText('ask a question'), {target: {value: 'Who does Elizabeth love? zzyzx'}});
  const answers = [...view.querySelectorAll('.answers li')];
  expect(answers).toHaveLength(10);
  const scores = answers.map((li) => Number(li.querySelector('small').textContent));
  expect(scores).toEqual([...scores].sort((a, b) => b - a)); // most similar first
  const hint = view.querySelector('.hint').textContent;
  expect(hint).toMatch(/Asking with elizabeth \(×[\d.]+\) \+ love \(×[\d.]+\)/); // stopwords dropped
  expect(hint).toContain('zzyzx'); // reported as unknown
  // answers and asked words highlighted on the map, plus the question itself
  expect(view.querySelectorAll('.space-map .answer')).toHaveLength(10);
  expect([...view.querySelectorAll('.space-map .asked text')].map((t) => t.textContent).sort()).toEqual(['elizabeth', 'love']);
  expect(view.querySelector('.space-map .query')).not.toBeNull();

  fireEvent.change(screen.getByLabelText('analogy a'), {target: {value: 'elizabeth'}});
  fireEvent.change(screen.getByLabelText('analogy b'), {target: {value: 'she'}});
  fireEvent.change(screen.getByLabelText('analogy c'), {target: {value: 'he'}});
  const analogyAnswers = [...view.querySelectorAll('.analogy-section .answers li')].map((li) => li.firstChild.textContent.trim());
  expect(analogyAnswers).toHaveLength(10);
  expect(analogyAnswers).not.toContain('elizabeth'); // inputs excluded
  fireEvent.change(screen.getByLabelText('analogy c'), {target: {value: 'zzyzx'}});
  expect(view.querySelector('.analogy-section .hint').textContent).toContain('zzyzx');
});

test(`instruction mode shows each word's weight, both phrases' nearest words, their similarity and both points`, async () => {
  render(<App />);
  await selectCorpus('proverbs');
  openView('ask');
  const view = await findView('Ask a question');
  fireEvent.click(within(view).getByRole('button', {name: 'instruction'}));
  await waitFor(() => expect(view.querySelector('.instruction-mode .weights')).not.toBeNull());
  expect(view.textContent).toContain('gutenberg-67-books'); // the instruction demo's default space
  expect(view.querySelector('.caption a').getAttribute('href')).toBe('https://arxiv.org/abs/2311.07911');

  const tables = [...view.querySelectorAll('.weights')];
  const rows = (table) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
  const phrase = rows(tables[0]);
  expect(phrase.map((r) => r[0])).toEqual(['make', 'no', 'mistakes']);
  const weight = (word) => Number(phrase.find((r) => r[0] === word)[2]);
  expect(weight('no')).toBeLessThan(weight('mistakes')); // common words weigh less
  expect(phrase.reduce((s, r) => s + Number(r[3].replace('%', '')), 0)).toBeGreaterThanOrEqual(99); // shares ~100%
  expect(rows(tables[1]).map((r) => r[0])).toEqual(['make', 'mistakes']);

  // stopwords and unknown words are shown as dropped
  fireEvent.change(screen.getByLabelText('comparison'), {target: {value: 'do the zzyzx'}});
  expect(rows(view.querySelectorAll('.weights')[1]).map((r) => r[1])).toEqual(['dropped: stopword', 'dropped: stopword', 'dropped: not in vocabulary']);
  fireEvent.change(screen.getByLabelText('comparison'), {target: {value: 'make mistakes'}});

  expect(view.querySelector('.similarity').textContent).toMatch(/Cosine similarity of the two phrases: 0\.\d{3}/);
  expect(view.querySelectorAll('.space-map .query')).toHaveLength(2);
  expect([...view.querySelectorAll('.space-map .query text')].map((t) => t.textContent)).toEqual(['make no mistakes', 'make mistakes']);
});

test('navigate marks the instruction and the context window, and shows when the instruction stops mattering', async () => {
  await buildProverbs(); // n = 2
  fireEvent.change(screen.getByLabelText('Instruction (optional)'), {target: {value: 'Make no mistakes'}});
  openView('navigate');
  const view = await findView('Navigate the chain');
  expect(view.querySelector('.hint .instruction').textContent).toBe('make no mistakes'); // spelled as the chain spells it
  fireEvent.click([...view.querySelectorAll('.chips-area .chip')].find((c) => c.textContent.startsWith('a ')));

  const sentence = screen.getByLabelText('sentence so far');
  expect(sentence.textContent).toBe('make no mistakes a');
  expect([...sentence.querySelectorAll('.instruction')].map((s) => s.textContent)).toEqual(['make', 'no', 'mistakes']);
  // the 2-word window still reaches back into the instruction, so the options differ
  expect(view.querySelector('.window-status').className).toContain('different');
  expect(view.querySelector('.window-status').textContent).toContain('1 of its words is still in the 2-word window');

  // one more word: the window is now all sentence, so the options are the same as without the instruction
  fireEvent.click(view.querySelector('.chips-area .chip:not(.end)'));
  expect(view.querySelector('.window-status').className).toContain('same');
  const context = [...sentence.querySelectorAll('.context')].map((s) => s.textContent);
  expect(context).toHaveLength(2);
  expect(sentence.querySelectorAll('.instruction.context')).toHaveLength(0);
});

test('generating with an instruction shows it and marks the words chosen while it was in the window', async () => {
  await buildProverbs(); // n = 2
  fireEvent.change(screen.getByLabelText('Instruction (optional)'), {target: {value: 'make no mistakes'}});
  fireEvent.click(button('generate'));
  const paragraph = home().querySelector('p:last-child');
  expect(paragraph.querySelector('.instruction').textContent).toBe('make no mistakes');
  // the first n (2) words of each of the 5 sentences, one word per mark
  const marked = [...paragraph.querySelectorAll('.in-window')].map((m) => m.textContent);
  expect(marked).toHaveLength(10);
  for (const m of marked) expect(m).not.toContain(' ');
  expect(home().querySelector('.caption a').getAttribute('href')).toBe('https://arxiv.org/abs/2311.07911');
});

describe('the harness (uses the synthetic share-prices corpus)', () => {
  async function buildShares(order) {
    render(<App />);
    await selectCorpus('share-prices');
    fireEvent.change(screen.getByLabelText('Context words (n)'), {target: {value: String(order)}});
    fireEvent.click(button('build'));
    await waitFor(() => expect(button('generate').disabled).toBe(false));
  }

  test('navigate: a tool token is intercepted; sell is refused until permitted, then NUM is filled', async () => {
    await buildShares(4);
    openView('navigate');
    const view = await findView('Navigate the chain');
    fireEvent.change(screen.getByLabelText('starting words'), {target: {value: 'sell my tesco shares'}});
    fireEvent.click(view.querySelector('.chip.phrase'));
    fireEvent.click([...view.querySelectorAll('.chips-area .chip')].find((c) => c.textContent.startsWith('$sell-tsco')));

    const panel = () => within(view).getByRole('note', {name: 'harness'});
    expect(panel().textContent).toContain('token $sell-tsco → tool sell, argument tsco');
    expect(panel().textContent).toContain('refused: the sell tool is not permitted');
    fireEvent.click([...view.querySelectorAll('.chips-area .chip')].find((c) => c.textContent.startsWith('result')));
    fireEvent.click([...view.querySelectorAll('.chips-area .chip')].find((c) => c.textContent.startsWith('NUM')));
    const sentence = screen.getByLabelText('sentence so far');
    expect(sentence.querySelector('.harness-filled').textContent).toBe('REFUSED');

    fireEvent.click(screen.getByLabelText('allow the sell tool (harness permission)'));
    expect(panel().textContent).toContain('pretended to sell tsco');
    expect(sentence.querySelector('.harness-filled').textContent).toBe('101'); // the fake price, filled by the harness
  });

  test('navigate: typed words the chain has never seen are a plain dead end', async () => {
    await buildShares(2);
    openView('navigate');
    const view = await findView('Navigate the chain');
    fireEvent.change(screen.getByLabelText('starting words'), {target: {value: 'tesco zzyzx'}});
    expect(view.querySelector('.dead-end').textContent).toMatch(/Dead end: “zzyzx” is not in this chain/);
    expect(view.querySelector('.chip.phrase')).toBeNull();
  });

  test('generate: tool tokens get harness panels and filled results, apart from the predicted words', async () => {
    await buildShares(6);
    fireEvent.click(button('generate'));
    const paragraph = home().querySelector('p:last-child');
    const panels = [...paragraph.querySelectorAll('[aria-label="harness"]')];
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) expect(p.textContent).toMatch(/^harness \(code, not the chain\)token \$(price|sell)-/);
    expect(paragraph.querySelector('.harness-filled')).not.toBeNull();
    // every NUM is either filled by the harness or marked as having no call before it
    const bare = [...paragraph.querySelectorAll('span')].filter((s) => s.textContent === 'NUM' && !s.querySelector('span'));
    expect(bare.every((s) => s.className === 'harness-unfilled')).toBe(true);
  });
});
