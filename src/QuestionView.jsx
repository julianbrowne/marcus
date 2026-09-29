import {useEffect, useState} from 'react';
import {analogy, cosine, nearest, queryVector} from './question';
import SegmentedButtons from './SegmentedButtons';
import InstructionCaption from './InstructionCaption';

// the instruction demo uses the largest general-English space, whatever corpus is selected
const INSTRUCTION_CORPUS = 'gutenberg-67-books';

const W = 1000;
const H = 560;
const PAD = 30;

function Results({results}) {
  return (
    <ol className="answers">
      {results.map(({word, similarity}) => (
        <li key={word}>{word} <small>{similarity.toFixed(2)}</small></li>
      ))}
    </ol>
  );
}

// the space's first two axes, with the top answers and the question's words labelled, and each
// query (a weighted average of its words, so it lands among them) as a diamond.
// queries: [{vector, label, className}]
function SpaceMap({space, answers, used, queries}) {
  const xs = space.words.map((_, i) => space.vector(i)[0]);
  const ys = space.words.map((_, i) => space.vector(i)[1]);
  for (const {vector} of queries) xs.push(vector[0]), ys.push(vector[1]);
  const scale = (values, size) => {
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    return (v) => PAD + ((v - min) / range) * (size - 2 * PAD);
  };
  const sx = scale(xs, W);
  const sy = scale(ys, H);
  const answer = new Set(answers.map((a) => a.word));
  const asked = new Set(used.map((u) => u.word));
  const highlighted = space.words.map((w, i) => [w, i]).filter(([w]) => answer.has(w) || asked.has(w));

  return (
    <svg className="space-map" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="All words on the space's first two axes, with the answers and the question marked">
      {space.words.map((w, i) => (
        <circle key={w} className="word-dot" r="2" cx={sx(space.vector(i)[0])} cy={sy(space.vector(i)[1])}>
          <title>{w}</title>
        </circle>
      ))}
      {highlighted.map(([w, i]) => (
        <g key={w} className={answer.has(w) ? 'answer' : 'asked'} transform={`translate(${sx(space.vector(i)[0])} ${sy(space.vector(i)[1])})`}>
          <circle r="5" />
          <text x="8" dominantBaseline="middle">{w}</text>
        </g>
      ))}
      {queries.map(({vector, label, className = ''}) => (
        <g key={label} className={`query ${className}`} transform={`translate(${sx(vector[0])} ${sy(vector[1])})`}>
          <rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" />
          <text x="12" dominantBaseline="middle">{label}</text>
        </g>
      ))}
    </svg>
  );
}

const MapCaption = ({space}) => (
  <figcaption className="hint">
    The map shows the first 2 of {space.dims} dimensions; the nearest words are found using all {space.dims}, so
    nearness on the map is only approximate.
  </figcaption>
);

// every word of a phrase and what happened to it: dropped as a stopword, not in the vocabulary,
// or used with a weight (log(total / count)) and its share of the phrase's vector
function Weights({terms}) {
  return (
    <table className="chain weights">
      <thead><tr><th>word</th><th>in the vector</th><th className="num">weight</th><th className="num">share</th></tr></thead>
      <tbody>
        {terms.map((t, i) => (
          <tr key={i} className={t.status}>
            <th>{t.word}</th>
            <td>{t.status === 'used' ? 'used' : t.status === 'stopword' ? 'dropped: stopword' : 'dropped: not in vocabulary'}</td>
            <td className="num">{t.weight.toFixed(2)}</td>
            <td className="num">{Math.round(100 * t.share)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// "make no mistakes" vs "make mistakes": an instruction is just more words, averaged into a vector
function InstructionMode({space}) {
  const [phrase, setPhrase] = useState('make no mistakes');
  const [other, setOther] = useState('make mistakes');
  const p = queryVector(space, phrase);
  const o = queryVector(space, other);
  const both = p.vector && o.vector;
  const nearestTo = (q) => (q.vector ? nearest(space, q.vector, 10, q.used.map((u) => u.word)) : []);
  const pAnswers = nearestTo(p);
  const oAnswers = nearestTo(o);

  return (
    <section className="instruction-mode">
      <InstructionCaption />
      <p className="hint">Using the {INSTRUCTION_CORPUS} word space ({space.words.length.toLocaleString()} words).</p>
      <div className="instruction-grid">
        {[[p, phrase, setPhrase, 'instruction', pAnswers], [o, other, setOther, 'comparison', oAnswers]].map(([q, text, set, label, answers]) => (
          <div key={label}>
            <input className="nav-input" aria-label={label} value={text} onChange={(e) => set(e.target.value)} />
            <Weights terms={q.terms} />
            {answers.length > 0 && <><h3>Nearest words</h3><Results results={answers} /></>}
          </div>
        ))}
      </div>
      {both && (
        <p className="similarity">
          Cosine similarity of the two phrases: <strong>{cosine(p.vector, o.vector).toFixed(3)}</strong>
          <span className="hint"> (1 = the same direction)</span>
        </p>
      )}
      <figure className="space-figure wide">
        <SpaceMap space={space} answers={[...pAnswers, ...oAnswers]} used={[...p.used, ...o.used]}
          queries={[p.vector && {vector: p.vector, label: phrase}, o.vector && {vector: o.vector, label: other, className: 'comparison'}].filter(Boolean)} />
        <MapCaption space={space} />
      </figure>
    </section>
  );
}

// space: loadSpace(src/corpus/space/<name>.json) for the selected corpus;
// loadSpaceFor(name): loads another corpus's space (for instruction mode)
export default function QuestionView({space, loadSpaceFor}) {
  const [mode, setMode] = useState('question');
  const [instructionSpace, setInstructionSpace] = useState(null);
  useEffect(() => {
    if (mode !== 'instruction' || instructionSpace) return undefined;
    let current = true;
    loadSpaceFor(INSTRUCTION_CORPUS).then((s) => current && setInstructionSpace(s));
    return () => {
      current = false;
    };
  }, [mode, instructionSpace, loadSpaceFor]);

  const [question, setQuestion] = useState('');
  const [terms, setTerms] = useState(['', '', '']);

  const q = question.trim() ? queryVector(space, question) : null;
  const answers = q?.vector ? nearest(space, q.vector, 10, q.used.map((u) => u.word)) : [];
  const [a, b, c] = terms;
  const analogous = a && b && c ? analogy(space, a, b, c) : null;
  const setTerm = (i) => (e) => setTerms(terms.map((t, j) => (j === i ? e.target.value : t)));

  return (
    <div className="scroll ask">
      <SegmentedButtons label="ask mode" options={['question', 'instruction']} active={mode} onSelect={setMode} />

      {mode === 'instruction' && (instructionSpace ? <InstructionMode space={instructionSpace} /> : <p className="hint">Loading the {INSTRUCTION_CORPUS} word space…</p>)}

      {mode === 'question' && <>
        <p className="caption">
          This is similarity retrieval over word co-occurrence, not how an LLM generates an answer.
        </p>

        <section>
          <input type="search" className="nav-input" aria-label="ask a question" placeholder="ask a question, e.g. what is the capital of france"
            value={question} onChange={(e) => setQuestion(e.target.value)} />
          {q && (
            <p className="hint">
              {q.used.length > 0
                ? <>Asking with {q.used.map((u) => `${u.word} (×${u.weight})`).join(' + ')}, weighted by rarity. </>
                : 'No words to ask with: only stopwords or unknown words. '}
              {q.unknown.length > 0 && `Not in the ${space.words.length.toLocaleString()} words known: ${q.unknown.join(', ')}.`}
            </p>
          )}
          <div className="ask-results">
            {answers.length > 0 && (
              <div>
                <h3>Nearest words</h3>
                <Results results={answers} />
              </div>
            )}
            <figure className="space-figure">
              <SpaceMap space={space} answers={answers} used={q?.used ?? []}
                queries={q?.vector ? [{vector: q.vector, label: 'your question'}] : []} />
              <MapCaption space={space} />
            </figure>
          </div>
        </section>

        <section className="analogy-section">
          <h3>Analogy</h3>
          <div className="analogy">
            <input aria-label="analogy a" placeholder="paris" value={a} onChange={setTerm(0)} />
            <span>−</span>
            <input aria-label="analogy b" placeholder="france" value={b} onChange={setTerm(1)} />
            <span>+</span>
            <input aria-label="analogy c" placeholder="italy" value={c} onChange={setTerm(2)} />
          </div>
          {analogous?.unknown.length > 0 && <p className="hint">Not known: {analogous.unknown.join(', ')}.</p>}
          {analogous?.results.length > 0 && <Results results={analogous.results} />}
        </section>
      </>}
    </div>
  );
}
