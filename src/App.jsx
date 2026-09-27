import {useEffect, useState} from 'react';
import {Blocks, Eraser, Sparkles, Waypoints} from 'lucide-react';
import {Markov, MAX_ORDER} from './markov';
import Modal from './Modal';
import WordMap from './WordMap';
import ChainTable from './ChainTable';
import CorpusProfile from './CorpusProfile';
import ViewMenu from './ViewMenu';

// Corpora are prepared at build time (scripts/prepare-corpora.mjs): raw text, clean text
// and a profile per corpus, each lazy-loaded on first use and keyed by path.
const files = {
  raw: import.meta.glob('./corpus/raw/*.txt', {query: '?raw', import: 'default'}),
  clean: import.meta.glob('./corpus/clean/*.txt', {query: '?raw', import: 'default'}),
  profile: import.meta.glob('./corpus/profile/*.json', {import: 'default'}),
};
const load = (kind, name) => files[kind][`./corpus/${kind}/${name}.${kind === 'profile' ? 'json' : 'txt'}`]();
const CORPORA = Object.keys(files.clean).map((path) => path.replace(/^.*\/|\.txt$/g, ''));

// the table only models the most frequent contexts
const TOP_WORDS = 300;

// ponytail: text views show the start of big corpora; a 50MB <pre> can hang the tab
const MAX_VIEW_CHARS = 1_000_000;

// status shown with the spinner while each blocking task runs
const BUSY = {
  raw: 'Loading raw text…',
  clean: 'Loading clean text…',
  profile: 'Loading profile…',
  build: 'Building chain…',
  graph: 'Loading word map…',
  table: 'Building table…',
};

const TITLES = {raw: 'Raw text', clean: 'Clean text', profile: 'Profile', graph: 'Word map', table: 'Chain table'};

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
};

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
  const [corpus, setCorpus] = useState(CORPORA.includes('trump') ? 'trump' : CORPORA[0]);
  const [order, setOrder] = useState('2'); // context words
  const [marcus, setMarcus] = useState(null);
  const [busy, setBusy] = useState(null); // null | a key of BUSY
  const [paragraphs, setParagraphs] = useState([]);
  const [view, setView] = useState(null); // null | {type: a key of views, data} for the open popup
  const [profile, setProfile] = useState(null); // headline figures for the selected corpus

  useEffect(() => {
    let current = true;
    setProfile(null);
    load('profile', corpus).then((p) => current && setProfile(p));
    return () => {
      current = false;
    };
  }, [corpus]);

  const n = Number(order);
  const validOrder = Number.isInteger(n) && n >= 1 && n <= MAX_ORDER;

  // any settings change invalidates the built chain
  function change(setter) {
    return (e) => {
      setter(e.target.value);
      setMarcus(null);
    };
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

  function open(type) {
    run(type, async () => {
      let data;
      if (type === 'raw' || type === 'clean' || type === 'profile') data = await load(type, corpus);
      if (type === 'graph') data = (await load('profile', corpus)).map;
      if (type === 'table') data = marcus.topContexts(TOP_WORDS);
      setView({type, data});
    });
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
            <select value={corpus} onChange={change(setCorpus)} disabled={!!busy}>
              {CORPORA.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <ViewMenu options={['raw', 'clean', 'profile']} label="view corpus" disabled={!!busy} onSelect={open} />
        </section>

        <section className="group">
          <h2 className="group-label">Chain</h2>
          <label className="field">
            Context words (n)
            <input type="number" min="1" max={MAX_ORDER} step="1" value={order}
              onChange={change(setOrder)} disabled={!!busy} aria-invalid={!validOrder} />
          </label>
          <button className="primary" onClick={() => run('build', async () => setMarcus(buildMarkov(await load('clean', corpus), n)))}
            disabled={!validOrder || !!busy}>
            <Blocks aria-hidden="true" /> build
          </button>
          <ViewMenu options={['graph', 'table']} disabled={!marcus || !!busy} onSelect={open} />
        </section>

        <footer className="sidebar-footer">
          <a href="https://github.com/julianbrowne/marcus">Source on GitHub</a> · CC BY-NC 4.0
        </footer>
      </aside>

      <main className="main">
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
            <div className="actions">
              <button className="primary" onClick={() => setParagraphs([...paragraphs, {text: marcus.generate(), order: marcus.order}])}
                disabled={!marcus || !!busy}>
                <Sparkles aria-hidden="true" /> generate
              </button>
              <button onClick={() => setParagraphs([])} disabled={paragraphs.length === 0}>
                <Eraser aria-hidden="true" /> clear
              </button>
            </div>
          </div>
          <div id="console" className="card-content">
            {paragraphs.length === 0 && <div className="empty">Nothing generated yet.</div>}
            {paragraphs.map(({text, order}, i) => (
              <p key={i}><span className="badge">n={order}</span> {text}</p>
            ))}
          </div>
        </section>
      </main>

      {view && (
        <Modal title={`${TITLES[view.type]}: ${corpus}`} onClose={() => setView(null)}>
          {views[view.type](view.data)}
        </Modal>
      )}
    </div>
  );
}
