import {useState} from 'react';
import {analogy, nearest, queryVector} from './question';

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

// the space's first two axes, with the top answers and the question's words labelled, and the
// question itself (a weighted average of its words, so it lands among them) as a diamond
function SpaceMap({space, answers, used, query}) {
  const xs = space.words.map((_, i) => space.vector(i)[0]);
  const ys = space.words.map((_, i) => space.vector(i)[1]);
  if (query) xs.push(query[0]), ys.push(query[1]);
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
      {query && (
        <g className="query" transform={`translate(${sx(query[0])} ${sy(query[1])})`}>
          <rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" />
          <text x="12" dominantBaseline="middle">your question</text>
        </g>
      )}
    </svg>
  );
}

// space: loadSpace(src/corpus/space/<name>.json)
export default function QuestionView({space}) {
  const [question, setQuestion] = useState('');
  const [terms, setTerms] = useState(['', '', '']);

  const q = question.trim() ? queryVector(space, question) : null;
  const answers = q?.vector ? nearest(space, q.vector, 10, q.used.map((u) => u.word)) : [];
  const [a, b, c] = terms;
  const analogous = a && b && c ? analogy(space, a, b, c) : null;
  const setTerm = (i) => (e) => setTerms(terms.map((t, j) => (j === i ? e.target.value : t)));

  return (
    <div className="scroll ask">
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
            <SpaceMap space={space} answers={answers} used={q?.used ?? []} query={q?.vector} />
            <figcaption className="hint">
              The map shows the first 2 of {space.dims} dimensions; the nearest words are found using all {space.dims}, so
              nearness on the map is only approximate.
            </figcaption>
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
    </div>
  );
}
