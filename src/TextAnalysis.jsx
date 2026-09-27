import {POS_GROUPS} from './pos';

// generated: [{order, paragraphs, profile}] from analysing the generated text, one per n;
// corpus: the corpus profile (built at build time with the same analysis)
const wordsPerSentence = (p) => p.wordsPerSentence ?? Math.round((10 * p.words) / (p.sentiment.sentences || 1)) / 10;

const METRICS = [
  ['Sentences analysed', (p) => p.sentiment.sentences.toLocaleString()],
  ['Words per sentence', wordsPerSentence],
  ['Reading ease (Flesch)', (p) => p.readability.flesch],
  ['Complex words', (p) => `${p.readability.complexWordsPct}%`],
  ...Object.keys(POS_GROUPS).map((pos) => [pos, (p) => `${p.partsOfSpeech[pos]}%`]),
  ['Positive sentences', (p) => `${p.sentiment.positivePct}%`],
  ['Negative sentences', (p) => `${p.sentiment.negativePct}%`],
  ['Negated words per 1,000', (p) => p.negatedPer1000],
];

export default function TextAnalysis({corpus, generated}) {
  return (
    <>
      <p className="hint">
        The generated text, grouped by context length, measured the same way as its corpus. As n rises the chain
        copies longer runs of the source, so with enough text its figures move towards the corpus's; a few
        paragraphs are a small sample, so generate several per n. (Generated sentences have no commas or quotes,
        which nudges readability and tagging a little.)
      </p>
      <div className="scroll">
        <table className="chain analysis">
          <thead>
            <tr>
              <th>measure</th>
              <th className="num">corpus</th>
              {generated.map(({order, paragraphs}) => (
                <th key={order} className="num">n={order} <small>({paragraphs} para{paragraphs > 1 ? 's' : ''})</small></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                <td className="num">{value(corpus)}</td>
                {generated.map(({order, profile}) => <td key={order} className="num">{value(profile)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
