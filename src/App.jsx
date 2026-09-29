import {useState} from 'react';
import {Blocks, Eraser, FlaskConical, ScanText, Sparkles, Waypoints, X} from 'lucide-react';
import InstructionCaption from './InstructionCaption';
import HarnessCall from './HarnessCall';
import {applyHarness} from './harness';
import {Markov, MAX_ORDER} from './markov';
import WordMap from './WordMap';
import ChainTable from './ChainTable';
import CorpusProfile from './CorpusProfile';
import TextAnalysis from './TextAnalysis';
import Navigator from './Navigator';
import QuestionView from './QuestionView';
import {loadSpace} from './question';
import SegmentedButtons from './SegmentedButtons';

// Corpora are prepared at build time (scripts/prepare-corpora.mjs): raw text, clean text
// and a profile per corpus, each lazy-loaded on first use and keyed by path.
const files = {
  raw: import.meta.glob('./corpus/raw/*.txt', {query: '?raw', import: 'default'}),
  clean: import.meta.glob('./corpus/clean/*.txt', {query: '?raw', import: 'default'}),
  profile: import.meta.glob('./corpus/profile/*.json', {import: 'default'}),
  space: import.meta.glob('./corpus/space/*.json', {import: 'default'}),
};
const load = (kind, name) => files[kind][`./corpus/${kind}/${name}.${kind === 'profile' || kind === 'space' ? 'json' : 'txt'}`]();
const CORPORA = Object.keys(files.clean).map((path) => path.replace(/^.*\/|\.txt$/g, ''));

// a corpus's word space, loaded once and kept (the instruction demo reuses the 67 books' space)
const spaces = new Map();
const loadSpaceFor = async (name) => {
  if (!spaces.has(name)) spaces.set(name, loadSpace(await load('space', name)));
  return spaces.get(name);
};

// the table only models the most frequent contexts
const TOP_WORDS = 500;

// ponytail: text views show the start of big corpora; a 50MB <pre> can hang the tab
const MAX_VIEW_CHARS = 1_000_000;

// status shown with the spinner while each blocking task runs
const BUSY = {
  corpus: 'Loading corpus…',
  raw: 'Loading raw text…',
  clean: 'Loading clean text…',
  profile: 'Loading profile…',
  build: 'Building chain…',
  graph: 'Loading word map…',
  table: 'Building table…',
  analysis: 'Analysing generated text…',
  navigate: 'Opening the chain…',
  ask: 'Loading word vectors…',
};

const TITLES = {raw: 'Raw text', clean: 'Clean text', profile: 'Profile', graph: 'Word map', table: 'Chain table', analysis: 'Generated text analysis', navigate: 'Navigate the chain', ask: 'Ask a question'};

// wait until the browser has painted, so the spinner shows before the main thread blocks
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

function buildMarkov(txt, order) {
  const marcus = new Markov(txt);
  marcus.setOrder(order);
  marcus.setMinWords(10);
  marcus.setMinSentences(5);
  marcus.buildChain();
  return marcus;
}

function TextView({text, note}) {
  const shown = text.slice(0, MAX_VIEW_CHARS);
  return (
    <>
      <p className="hint">
        {note}
        {shown.length < text.length && ` Showing the first ${shown.length.toLocaleString()} of ${text.length.toLocaleString()} characters.`}
      </p>
      <div className="scroll">
        <pre className="corpus">{shown}</pre>
      </div>
    </>
  );
}

const views = {
  raw: (text) => <TextView text={text} note="The source file as downloaded." />,
  clean: (text) => <TextView text={text} note={`Cleaned at build time, one sentence per line (${text.split('\n').length.toLocaleString()} sentences). This is what the chain reads.`} />,
  profile: (profile) => <CorpusProfile profile={profile} />,
  graph: (map) => <WordMap map={map} />,
  table: (rows) => <ChainTable rows={rows} />,
  analysis: (data) => <TextAnalysis {...data} />,
  navigate: (marcus, {instruction, permissions}) => (
    <Navigator key={marcus.order} marcus={marcus} instruction={marcus.spell(instruction)} permissions={permissions} />
  ),
  ask: (space) => <QuestionView space={space} loadSpaceFor={loadSpaceFor} />,
};

// analyse generated text with wink-nlp, loaded on first use (~1MB), one group per context length
async function analyseGenerated(paragraphs) {
  const {analyse} = await import('./analyse.js');
  const orders = [...new Set(paragraphs.map((p) => p.order))].sort((a, b) => a - b);
  return orders.map((order) => {
    const texts = paragraphs.filter((p) => p.order === order).map((p) => p.text);
    return {order, paragraphs: texts.length, profile: analyse(texts.join('\n')).profile};
  });
}

// a generated paragraph, sentence by sentence: tool tokens go through the harness (its panel and
// filled-in results are shown apart from the predicted words), and with an instruction the first
// `order` words of each sentence (chosen while it was still inside the context window) are marked
function Paragraph({text, order, instruction, permissions}) {
  const sentences = text.trim().split(/(?<=\.) /).map((s) => s.replace(/\.$/, '').split(' '));
  return (
    <>
      {instruction && <><span className="instruction">{instruction}</span>{' '}</>}
      {sentences.map((words, i) => (
        <span key={i}>
          {applyHarness(words, permissions).map((t, j) => {
            const inWindow = instruction && j < order ? 'in-window' : undefined;
            return (
              <span key={j}>
                {j > 0 && ' '}
                {t.kind === 'call' && <><span className={inWindow}>{t.word}</span> <HarnessCall call={t.call} /></>}
                {t.kind === 'filled' && <span className="harness-filled" title="filled in by the harness">{t.word}</span>}
                {t.kind === 'unfilled' && <span className="harness-unfilled" title="no tool call before it: the harness has nothing to fill it with">{t.word}</span>}
                {t.kind === 'word' && <span className={inWindow}>{t.word}</span>}
              </span>
            );
          })}
          {'. '}
        </span>
      ))}
    </>
  );
}

function Stat({label, value, note}) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export default function App() {
  const [corpus, setCorpus] = useState(''); // none until the user picks one
  const [order, setOrder] = useState('2'); // context words
  const [marcus, setMarcus] = useState(null);
  const [busy, setBusy] = useState(null); // null | a key of BUSY
  const [paragraphs, setParagraphs] = useState([]);
  const [view, setView] = useState(null); // null (generated text) | {type: a key of views, data} shown in the main pane
  const [profile, setProfile] = useState(null); // headline figures for the selected corpus
  const [instruction, setInstruction] = useState(''); // words placed before each sentence, e.g. "make no mistakes"
  const [allowSell, setAllowSell] = useState(false); // harness permission for the (fake) sell tool
  const instructionWords = instruction.trim().split(/\s+/).filter(Boolean);

  const n = Number(order);
  const validOrder = Number.isInteger(n) && n >= 1 && n <= MAX_ORDER;

  // any settings change invalidates the built chain, and any view showing the old data
  function chooseCorpus(e) {
    const name = e.target.value;
    setCorpus(name);
    setMarcus(null);
    setView(null);
    setProfile(null);
    // with the spinner: on a slow connection the figures can take a moment
    run('corpus', async () => setProfile(await load('profile', name)));
  }

  function chooseOrder(e) {
    setOrder(e.target.value);
    setMarcus(null);
    setView((v) => (v?.type === 'table' || v?.type === 'navigate' ? null : v)); // these show the chain itself
  }

  async function run(kind, work) {
    setBusy(kind);
    try {
      await nextPaint();
      await work();
    } finally {
      setBusy(null);
    }
  }

  // clicking the open view's button again goes back to the generated text
  function toggle(type) {
    if (view?.type === type) setView(null);
    else open(type);
  }

  function open(type) {
    run(type, async () => {
      let data;
      if (type === 'raw' || type === 'clean' || type === 'profile') data = await load(type, corpus);
      if (type === 'graph') data = (await load('profile', corpus)).map;
      if (type === 'table') data = marcus.topContexts(TOP_WORDS);
      if (type === 'navigate') data = marcus;
      if (type === 'ask') data = await loadSpaceFor(corpus);
      if (type === 'analysis') data = {corpus: profile, generated: await analyseGenerated(paragraphs)};
      setView({type, data});
    });
  }

  function generate() {
    const words = marcus.spell(instructionWords);
    setParagraphs([...paragraphs, {text: marcus.generate(words), order: marcus.order, instruction: words.join(' '), permissions: {allowSell}}]);
    setView(null); // show it
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Waypoints size={18} aria-hidden="true" /></span>
          <div>
            <strong>Marcus</strong>
            <small>Markov chain explorer</small>
          </div>
        </div>

        <section className="group">
          <h2 className="group-label">Corpus</h2>
          <label className="field">
            <span className="sr-only">Corpus</span>
            <select value={corpus} onChange={chooseCorpus} disabled={!!busy}>
              <option value="" disabled>select a corpus</option>
              {CORPORA.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <SegmentedButtons label="view corpus" options={['raw', 'clean', 'profile', 'ask']} active={view?.type}
            disabled={!corpus || !!busy} onSelect={toggle} />
        </section>

        <section className="group divided">
          <h2 className="group-label">Chain</h2>
          <label className="field">
            Context words (n)
            <input type="number" min="1" max={MAX_ORDER} step="1" value={order}
              onChange={chooseOrder} disabled={!!busy} aria-invalid={!validOrder} />
          </label>
          <label className="field">
            Instruction (optional)
            <input type="text" value={instruction} placeholder="e.g. make no mistakes"
              onChange={(e) => setInstruction(e.target.value)} disabled={!!busy} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={allowSell} onChange={(e) => setAllowSell(e.target.checked)} />
            allow the sell tool (harness permission)
          </label>
          <button className={marcus ? '' : 'cta'} onClick={() => run('build', async () => setMarcus(buildMarkov(await load('clean', corpus), n)))}
            disabled={!corpus || !validOrder || !!busy}>
            <Blocks aria-hidden="true" /> build
          </button>
          <SegmentedButtons label="view chain" options={['graph', 'table', 'navigate']} active={view?.type}
            disabled={!marcus || !!busy} onSelect={toggle} />
          <div className="button-row">
            <button className={marcus ? 'cta' : ''} onClick={generate} disabled={!marcus || !!busy}>
              <Sparkles aria-hidden="true" /> generate
            </button>
            <button onClick={() => setParagraphs([])} disabled={paragraphs.length === 0}>
              <Eraser aria-hidden="true" /> clear
            </button>
          </div>
        </section>

        <footer className="sidebar-footer">
          <a className="test-report" href="./tests/index.html" target="_blank" rel="noopener">
            <FlaskConical aria-hidden="true" /> Test report
          </a>
          <div>
            <a href="https://github.com/julianbrowne/marcus">Source on GitHub</a> · CC BY-NC 4.0
          </div>
        </footer>
      </aside>

      <main className="main">
        {corpus && (
          <>
            <header className="page-header">
              <div>
                <h1>{corpus}</h1>
                <p className="muted">
                  {marcus ? `Chain built with ${marcus.order} context word${marcus.order > 1 ? 's' : ''}.` : 'Choose a context length and build the chain.'}
                </p>
              </div>
              <p className="status" role="status">
                {busy && <><span className="spinner" aria-hidden="true" /> {BUSY[busy]}</>}
              </p>
            </header>

            {view ? (
              <section className="panel" aria-label={TITLES[view.type]}>
                <div className="panel-header">
                  <h2>{TITLES[view.type]}</h2>
                  <button className="close" aria-label="close" title="Back to generated text" onClick={() => setView(null)}>
                    <X aria-hidden="true" />
                  </button>
                </div>
                {views[view.type](view.data, {instruction: instructionWords, permissions: {allowSell}})}
              </section>
            ) : (
              <>
                {profile && (
                  <div className="stats">
                    <Stat label="Words" value={profile.words.toLocaleString()} note={`${profile.distinctWords.toLocaleString()} distinct`} />
                    <Stat label="Sentences" value={profile.sentences.toLocaleString()} note={`${profile.wordsPerSentence} words each on average`} />
                    <Stat label="Reading ease" value={profile.readability.flesch} note={`Flesch score: ${profile.readability.band}`} />
                    <Stat label="Tone" value={`${profile.sentiment.positivePct}%`} note={`positive sentences, ${profile.sentiment.negativePct}% negative`} />
                  </div>
                )}

                <section className="card">
                  <div className="card-header">
                    <div>
                      <h2>Generated text</h2>
                      <p className="muted">Each paragraph is five sentences sampled from the chain.</p>
                    </div>
                    <button onClick={() => open('analysis')} disabled={paragraphs.length === 0 || !profile || !!busy}>
                      <ScanText aria-hidden="true" /> analyse
                    </button>
                  </div>
                  <div id="console" className="card-content">
                    {paragraphs.length === 0 && <div className="empty">Nothing generated yet.</div>}
                    {paragraphs.some((p) => p.instruction) && (
                      <>
                        <InstructionCaption />
                        <p className="hint">
                          Underlined words were chosen while the instruction was still inside the n-word context window;
                          after that the chain cannot see it.
                        </p>
                      </>
                    )}
                    {paragraphs.map(({text, order, instruction, permissions}, i) => (
                      <p key={i}>
                        <span className="badge">n={order}</span>{' '}
                        <Paragraph text={text} order={order} instruction={instruction} permissions={permissions} />
                      </p>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
