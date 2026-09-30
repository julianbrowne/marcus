import {useState} from 'react';
import {Send} from 'lucide-react';
import {COMPANIES, TOOLS, converse, toolResult} from './harness';

const pretty = (word) => JSON.stringify(JSON.parse(word), null, 1).replace(/\n\s*/g, ' ');

// the chain's words, each with the context it was chosen from on hover
const Words = ({out}) => out.map(({word, context}, i) => (
  <span key={i} title={`chosen after “${context.join(' ')}”`}>{i > 0 && ' '}{word}</span>
));

// the price the chain wrote
const priceIn = (out) => out.map((o) => o.word).find((w) => /^\d+\.\dp$/.test(w));

// Ask a share-price question and follow it through the harness loop: the chain only predicts words;
// the harness (src/harness.js) spots the tool call, runs it against a fake price table and calls
// the chain again. marcus: the chain built from the share-prices corpus (or null, not built yet)
export default function ToolUseView({marcus}) {
  const [question, setQuestion] = useState("What's Tesco's share price today?");
  const [run, setRun] = useState(null);

  const ask = (e) => {
    e.preventDefault();
    setRun(converse(marcus, question));
  };
  const {first, call, result, second} = run ?? {};
  const asked = run && COMPANIES.find(([c]) => question.toLowerCase().includes(c.toLowerCase()));
  const written = second && priceIn(second.out);

  return (
    <div className="scroll tool-use">
      <p className="caption">An agent harness is ordinary code: the model only writes text in an agreed format</p>

      <table className="chain prices" aria-label="fake api prices">
        <caption>What the fake price api returns today (made up, not market data)</caption>
        <thead><tr><th>company</th><th>ticker</th><th className="num">price</th></tr></thead>
        <tbody>
          {COMPANIES.map(([c, t, p]) => (
            <tr key={t} className={call?.input?.ticker === t ? 'called' : undefined}><th>{c}</th><td><code>{t}</code></td><td className="num">{p}</td></tr>
          ))}
        </tbody>
      </table>

      {!marcus ? (
        <p className="hint">Build the chain to ask it. With 7 or more context words it can get the ticker and the price right.</p>
      ) : (
        <form className="ask-form" onSubmit={ask}>
          <input className="nav-input" aria-label="share price question" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="cta" type="submit" disabled={!question.trim()}><Send aria-hidden="true" /> ask</button>
        </form>
      )}

      {run && (
        <ol className="steps">
          <li>
            <h3>Harness → chain</h3>
            <pre className="corpus">{`tools: ${JSON.stringify(TOOLS, null, 1).replace(/\n\s*/g, ' ')}\nuser: ${question}\nassistant:`}</pre>
            <p className="hint">The chain sees only the last {marcus.order} words of this, so the tool list is out of sight; it writes a call because every transcript it learnt from did.</p>
          </li>
          <li>
            <h3>Chain → harness</h3>
            <p className="model-text"><Words out={first.out} /></p>
            <p className="hint">
              stop_reason: <code>{first.stop}</code>
              {call && <>. The ticker was chosen after “{first.out.at(-1).context.join(' ')}”{asked && (call.input?.ticker === asked[1] ? ': right for the question.' : `: the question was about ${asked[0]} (${asked[1]}).`)}</>}
            </p>
          </li>
          {call && <>
            <li>
              <h3>Harness (ordinary code, not the chain)</h3>
              <pre className="corpus">{`if stop_reason == "tool_use":\n    price = fake_api(${JSON.stringify(call.input?.ticker)})   # ${result.message}\n    append ${pretty(toolResult(result.content))}\n    call the chain again`}</pre>
            </li>
            <li>
              <h3>Chain → harness</h3>
              <p className="model-text"><Words out={second.out} /></p>
              <p className={`verdict ${written === result.content ? 'match' : 'mismatch'}`}>
                {!result.ok ? 'The tool call failed, so there was no price to repeat.'
                  : written === result.content ? `The price matches the api (${result.content}): with ${marcus.order} context words the chain still saw the tool result when it wrote the price, after the same words as in training.`
                    : `The api said ${result.content}${written ? ` but the chain wrote ${written}, a price it saw in training` : ' but the chain wrote no price'}: the tool result was more than ${marcus.order} words back when it chose. A chain can't copy; it only repeats what followed the same words before.`}
              </p>
            </li>
          </>}
        </ol>
      )}
      {run && <p className="hint">Hover over a word to see the context it was chosen after.</p>}
    </div>
  );
}
