import {posColour} from './pos';
import ToneArc from './ToneArc';

const num = (n) => n.toLocaleString();

// profile: src/corpus/profile/<name>.json, made at build time by scripts/prepare-corpora.mjs
export default function CorpusProfile({profile: p}) {
  const largest = Math.max(...Object.values(p.partsOfSpeech));
  return (
    <div className="scroll profile">
      <section>
        <h3>Size</h3>
        <dl>
          <dt>Words</dt><dd>{num(p.words)}</dd>
          <dt>Distinct words</dt><dd>{num(p.distinctWords)}</dd>
          <dt>Sentences</dt><dd>{num(p.sentences)}</dd>
          <dt>Words per sentence</dt><dd>{p.wordsPerSentence}</dd>
        </dl>
      </section>

      <section>
        <h3>Readability</h3>
        <dl>
          <dt>Flesch reading ease</dt><dd>{p.readability.flesch} <small>({p.readability.band}; 100 is easiest)</small></dd>
          <dt>Complex words</dt><dd>{p.readability.complexWordsPct}%</dd>
          <dt>Reading time</dt><dd>{num(p.readability.readingTimeMins)} minutes</dd>
        </dl>
      </section>

      <section>
        <h3>Parts of speech</h3>
        <table className="bars">
          <tbody>
            {Object.entries(p.partsOfSpeech).map(([pos, share]) => (
              <tr key={pos}>
                <th>{pos}</th>
                <td><span className="bar" style={{width: `${(100 * share) / largest}%`, background: posColour(pos)}} /></td>
                <td className="num">{share}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Tone</h3>
        <dl>
          <dt>Positive sentences</dt><dd>{p.sentiment.positivePct}%</dd>
          <dt>Neutral sentences</dt><dd>{p.sentiment.neutralPct}%</dd>
          <dt>Negative sentences</dt><dd>{p.sentiment.negativePct}%</dd>
          <dt>Negated words</dt><dd>{p.negatedPer1000} per 1,000</dd>
        </dl>
        <p className="hint">Sentiment is scored from a word list: a guide to overall tone, not a judgement of single sentences.</p>
      </section>

      {p.distinctiveWords?.length > 0 && (
        <section className="wide">
          <h3>Distinctive words</h3>
          <p className="words">{p.distinctiveWords.map((word) => <span key={word}>{word}</span>)}</p>
          <p className="hint">Words that set this corpus apart from the others (BM25 scoring): its own names, places and subjects.</p>
        </section>
      )}

      {p.toneArc?.length > 0 && (
        <section className="wide">
          <h3>Tone across the text</h3>
          <ToneArc arc={p.toneArc} />
          <p className="hint">Average sentence sentiment in {p.toneArc.length} equal slices, start to finish. For a collection of stories this follows the collection's order, not one plot.</p>
        </section>
      )}

      {p.keySentences?.length > 0 && (
        <section className="wide">
          <h3>Key sentences</h3>
          <ol className="key-sentences">{p.keySentences.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="hint">The most representative sentences (of 8–40 words): those sharing the most with the rest of the text.</p>
        </section>
      )}

      <section className="wide">
        <h3>Most common content words</h3>
        <p className="words">{p.topWords.map(({word, count}) => <span key={word}>{word} <small>{num(count)}</small></span>)}</p>
      </section>

      {p.entities.length > 0 && (
        <section className="wide">
          <h3>Numbers, dates and amounts</h3>
          <table className="entities">
            <tbody>
              {p.entities.map(({type, count, examples}) => (
                <tr key={type}>
                  <th>{type.toLowerCase()}</th>
                  <td className="num">{num(count)}</td>
                  <td>{examples.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
