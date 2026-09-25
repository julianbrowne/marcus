import {useState} from 'react';
import {Markov} from './markov';
import Modal from './Modal';
import WordMap from './WordMap';
import ChainTable, {summarise} from './ChainTable';
import ViewMenu from './ViewMenu';
import {clean} from './textprep';
import {embed} from './embed';

// one lazy-loaded chunk per corpus file, keyed by path e.g. './corpus/grimm.txt'
const corpora = import.meta.glob('./corpus/*.txt', {query: '?raw', import: 'default'});

// graph and table only model the most frequent words
const TOP_WORDS = 300;

const corpusName = (path) => path.replace(/^.*\/|\.txt$/g, '');

// raw file -> cleaned text, cleaned once per corpus per session
const cleaned = new Map();
async function loadCorpus(path) {
  if (!cleaned.has(path)) cleaned.set(path, clean(await corpora[path]()));
  return cleaned.get(path);
}

// status shown with the spinner while each blocking task runs
const BUSY = {
  view: 'Cleaning text…',
  build: 'Cleaning text and building chain…',
  graph: 'Drawing word map…',
  table: 'Building table…',
};

// wait until the browser has painted, so the spinner shows before the main thread blocks
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

function buildMarkov(txt, ngrams) {
  const marcus = new Markov(txt);
  marcus.setNgrams(ngrams);
  marcus.setMinWords(10);
  marcus.setMinSentences(5);
  marcus.buildChain();
  return marcus;
}

export default function App() {
  const [corpus, setCorpus] = useState('./corpus/trump.txt');
  const [ngrams, setNgrams] = useState('4');
  const [marcus, setMarcus] = useState(null);
  const [busy, setBusy] = useState(null); // null | a key of BUSY
  const [text, setText] = useState(null); // cleaned corpus being viewed
  const [paragraphs, setParagraphs] = useState([]);
  const [view, setView] = useState(null); // null | {type: 'graph', points} | {type: 'table', rows}

  const n = Number(ngrams);
  const validNgrams = Number.isInteger(n) && n >= 1 && n <= 10;

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

  function openView(type) {
    run(type, () => setView(type === 'graph' ?
      {type, points: embed(marcus.chain, {rows: TOP_WORDS})} :
      {type, rows: summarise(marcus.chain).slice(0, TOP_WORDS)}));
  }

  return (
    <div className="container">
      <h1>Marcus</h1>
      <div className="controls">
        <label>
          Corpus{' '}
          <select value={corpus} onChange={change(setCorpus)} disabled={!!busy}>
            {Object.keys(corpora).map((path) => <option key={path} value={path}>{corpusName(path)}</option>)}
          </select>
        </label>
        <button onClick={() => run('view', async () => setText(await loadCorpus(corpus)))}
          disabled={!!busy} aria-label="view corpus">
          view
        </button>
      </div>
      <div className="controls">
        <label>
          N-grams{' '}
          <input type="number" min="1" max="10" step="1" value={ngrams}
            onChange={change(setNgrams)} disabled={!!busy} aria-invalid={!validNgrams} />
        </label>
        <button onClick={() => run('build', async () => setMarcus(buildMarkov(await loadCorpus(corpus), n)))}
          disabled={!validNgrams || !!busy}>
          build
        </button>
        <button onClick={() => setParagraphs([...paragraphs, {text: marcus.generate(), ngrams: marcus.ngramSize}])}
          disabled={!marcus || !!busy}>
          generate
        </button>
        <button onClick={() => setParagraphs([])} disabled={paragraphs.length === 0}>
          clear
        </button>
        <ViewMenu disabled={!marcus || !!busy} onSelect={openView} />
      </div>
      <p className="status" role="status">
        {busy && <><span className="spinner" aria-hidden="true" /> {BUSY[busy]}</>}
      </p>
      <div id="console">
        {paragraphs.map(({text, ngrams}, i) => (
          <p key={i}><span className="badge">n={ngrams}</span> {text}</p>
        ))}
      </div>
      {view && marcus && (
        <Modal title={view.type === 'graph' ? 'Word map' : 'Chain table'} onClose={() => setView(null)}>
          {view.type === 'graph' ? <WordMap points={view.points} /> : <ChainTable rows={view.rows} />}
        </Modal>
      )}
      {text !== null && (
        <Modal title={`Corpus: ${corpusName(corpus)}`} onClose={() => setText(null)}>
          <p className="hint">Cleaned text, one sentence per line ({text.split('\n').length.toLocaleString()} sentences).</p>
          <div className="scroll">
            <pre className="corpus">{text}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
