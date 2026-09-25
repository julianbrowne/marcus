import {useState} from 'react';

// ponytail: capped so the DOM stays small (chains reach ~250k links)
const MAX_LINKS = 10;

// [{word, total, links: [{next, count}]}], most frequent first
export function summarise(chain) {
  return Object.entries(chain)
    .map(([word, nexts]) => {
      const counts = new Map();
      for (const next of nexts) counts.set(next, (counts.get(next) || 0) + 1);
      const links = [...counts].map(([next, count]) => ({next, count})).sort((a, b) => b.count - a.count);
      return {word, total: nexts.length, links};
    })
    .sort((a, b) => b.total - a.total);
}

const pct = (count, total) => `${((100 * count) / total).toFixed(1)}%`;

export default function ChainTable({rows}) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const matches = q ? rows.filter((r) => r.word.toLowerCase().startsWith(q)) : rows;

  return (
    <>
      <p className="hint">
        <input type="search" placeholder="filter words" aria-label="filter words"
          value={filter} onChange={(e) => setFilter(e.target.value)} />{' '}
        {matches.length} of the {rows.length} most frequent words; top {MAX_LINKS} links each.
      </p>
      <div className="scroll">
        <table className="chain">
          <thead>
            <tr><th>word</th><th>linked words</th><th>count</th><th>%</th></tr>
          </thead>
          {matches.map(({word, total, links}) => {
            const top = links.slice(0, MAX_LINKS);
            const rest = links.slice(MAX_LINKS);
            const restCount = rest.reduce((s, l) => s + l.count, 0);
            return (
              <tbody key={word}>
                {top.map(({next, count}, i) => (
                  <tr key={next}>
                    {i === 0 && <th rowSpan={top.length + (rest.length ? 1 : 0)}>{word} <small>({total})</small></th>}
                    <td>{next}</td><td className="num">{count}</td><td className="num">{pct(count, total)}</td>
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
