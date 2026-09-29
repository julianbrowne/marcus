import {useState} from 'react';
import {RotateCcw, Undo2} from 'lucide-react';
import InstructionCaption from './InstructionCaption';

const START_WORDS = 500; // sentence starters offered
const MAX_OPTIONS = 60; // next words shown at once (the rest are summarised)

const pct = (count, total) => `${((100 * count) / total).toFixed(count / total < 0.1 ? 1 : 0)}%`;

// typed words the chain knows, as it spells them (null for any it doesn't)
function resolve(marcus, text) {
  return marcus.spell(text.trim().split(/\s+/).filter(Boolean)).map((w) => (marcus.ids.has(w) ? w : null));
}

const sameOptions = (a, b) =>
  a.total === b.total && a.options.length === b.options.length &&
  a.options.every((o, i) => o.word === b.options[i].word && o.count === b.options[i].count);

// Walk the chain by hand: pick a start, then one of the words that followed the same context in the corpus.
// instruction: words placed before the sentence (from the sidebar), to show they only matter while in the window
export default function Navigator({marcus, instruction = []}) {
  const [path, setPath] = useState([]); // words chosen so far
  const [atStart, setAtStart] = useState(true); // did the path begin a sentence?
  const [ended, setEnded] = useState(false);
  const [typed, setTyped] = useState('');

  const begin = (words, fromStart) => {
    setPath(words);
    setAtStart(fromStart);
    setEnded(false);
  };
  const reset = () => begin([], true);
  const back = () => (ended ? setEnded(false) : path.length > 1 ? setPath(path.slice(0, -1)) : reset());

  if (path.length === 0) {
    const starts = marcus.followers([]);
    const q = typed.trim().toLowerCase();
    const matching = starts.options.filter((o) => o.word && o.word.toLowerCase().startsWith(q)).slice(0, START_WORDS);
    // typed words from anywhere in a sentence, if the chain knows what follows them
    const words = resolve(marcus, typed);
    const phrase = words.length && !words.includes(null) && marcus.followers(words, false).total > 0 ? words : null;
    return (
      <>
        <p className="hint">
          Build a sentence by hand. Pick where to start, then pick each next word from the words that followed the
          same {marcus.order}-word context in the corpus. Nothing here tries to make sense: it shows how each choice
          only depends on the last {marcus.order} word{marcus.order > 1 ? 's' : ''}.
        </p>
        {instruction.length > 0 && (
          <>
            <InstructionCaption />
            <p className="hint">Instruction placed before the sentence: <span className="instruction">{instruction.join(' ')}</span></p>
          </>
        )}
        <input type="search" className="nav-input" placeholder="starting words" aria-label="starting words"
          value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="scroll chips-area">
          {phrase && (
            <div className="chips">
              <button className="chip phrase" onClick={() => begin(phrase, false)}>start from “{phrase.join(' ')}” mid-sentence</button>
            </div>
          )}
          <p className="chips-label">
            {q ? `Sentence starters beginning “${typed.trim()}”` : `The ${Math.min(START_WORDS, starts.options.length)} most common sentence starters`}
            {' '}({matching.length}{matching.length === START_WORDS ? '+' : ''})
          </p>
          <div className="chips">
            {matching.map(({word, count}) => (
              <button key={word} className="chip" onClick={() => begin([word], true)}>
                {word} <small>{pct(count, starts.total)}</small>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // the instruction comes before a sentence, so it only applies to paths that start one
  const before = atStart ? instruction : [];
  const full = [...before, ...path];
  const next = marcus.followers(full, atStart);
  const contextFrom = full.length - next.context.length; // words from here on are the context
  const without = before.length ? marcus.followers(path, atStart) : null;
  // instruction words inside the n-word window (before any backoff): while there are any, the window
  // also no longer starts at the sentence start, so the options differ even if backoff skips them
  const instructionInWindow = Math.max(0, before.length - (full.length - marcus.order));
  const shown = next.options.slice(0, MAX_OPTIONS);
  const rest = next.options.slice(MAX_OPTIONS);
  const restCount = rest.reduce((s, o) => s + o.count, 0);

  return (
    <>
      <p className="sentence" aria-label="sentence so far">
        {full.map((w, i) => (
          <span key={i}>{i > 0 && ' '}<span className={[i < before.length && 'instruction', i >= contextFrom && 'context'].filter(Boolean).join(' ') || undefined}>{w}</span></span>
        ))}
        {ended && <span className="stop">.</span>}
      </p>
      {without && !ended && (
        <p className={`window-status ${sameOptions(next, without) ? 'same' : 'different'}`}>
          {sameOptions(next, without)
            ? `Same next-word options as without the instruction: it has slid out of the ${marcus.order}-word window.`
            : `Different options from without the instruction: ${instructionInWindow} of its words ${instructionInWindow === 1 ? 'is' : 'are'} still in the ${marcus.order}-word window.`}
        </p>
      )}
      {next.backedOff > 0 && !ended && (
        <p className="hint">
          The corpus never had these {marcus.order} words in a row, so the chain backed off to the last {next.context.length}
          {' '}(“{next.context.join(' ')}”).
        </p>
      )}
      <div className="nav-actions">
        <button onClick={back}><Undo2 aria-hidden="true" /> back</button>
        <button onClick={reset}><RotateCcw aria-hidden="true" /> start again</button>
      </div>
      {ended ? (
        <p className="hint">The sentence ends here: in the corpus, a sentence ended after “{next.context.join(' ')}”.</p>
      ) : (
        <div className="scroll chips-area">
          <p className="chips-label">
            {next.context.length
              ? <>After “<span className="context">{next.context.join(' ')}</span>” the corpus continued with ({next.options.length} option{next.options.length > 1 ? 's' : ''}):</>
              : 'At the start of a sentence the corpus began with:'}
          </p>
          <div className="chips">
            {shown.map(({word, count}) => (word === null ? (
              <button key="end" className="chip end" onClick={() => setEnded(true)}>
                end of sentence <small>{pct(count, next.total)}</small>
              </button>
            ) : (
              <button key={word} className="chip" onClick={() => setPath([...path, word])}>
                {word} <small>{pct(count, next.total)}</small>
              </button>
            )))}
          </div>
          {rest.length > 0 && (
            <p className="hint">+{rest.length.toLocaleString()} rarer words ({pct(restCount, next.total)} of continuations) not shown.</p>
          )}
        </div>
      )}
    </>
  );
}
