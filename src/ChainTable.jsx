import {useState} from 'react';

// ponytail: capped so the DOM stays small (chains reach ~250k links)
const MAX_LINKS = 10;

const pct = (count, total) => `${((100 * count) / total).toFixed(1)}%`;

// rows: Markov.topContexts(), [{context, total, links: [{next (null = sentence ended), count}]}]
export default function ChainTable({rows}) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const matches = q ? rows.filter((r) => r.context.toLowerCase().startsWith(q)) : rows;

  return (
    <>
      <p className="hint">
        <input type="search" placeholder="filter contexts" aria-label="filter contexts"
          value={filter} onChange={(e) => setFilter(e.target.value)} />{' '}
        {matches.length} of the {rows.length} most frequent contexts; top {MAX_LINKS} next words each.
      </p>
      <div className="scroll">
        <table className="chain">
          <thead>
            <tr><th>context</th><th>next word</th><th>count</th><th>%</th></tr>
          </thead>
          {matches.map(({context, total, links}) => {
            const top = links.slice(0, MAX_LINKS);
            const rest = links.slice(MAX_LINKS);
            const restCount = rest.reduce((s, l) => s + l.count, 0);
            return (
              <tbody key={context}>
                {top.map(({next, count}, i) => (
                  <tr key={next ?? ''}>
                    {i === 0 && <th rowSpan={top.length + (rest.length ? 1 : 0)}>{context} <small>({total})</small></th>}
                    <td>{next ?? <em className="end">end of sentence</em>}</td><td className="num">{count}</td><td className="num">{pct(count, total)}</td>
                  </tr>
                ))}
                {rest.length > 0 && (
                  <tr className="rest"><td>+{rest.length} others</td><td className="num">{restCount}</td><td className="num">{pct(restCount, total)}</td></tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </>
  );
}
