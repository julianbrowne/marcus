import {useState} from 'react';
import {POS_COLOURS} from './pos';

const ZOOM = 3; // spread points out; labels stay the same size
const W = 800 * ZOOM;
const H = 600 * ZOOM;
const PAD = 40;
const UNTAGGED = '#8a8a86';

function scale(values, size) {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return (v) => PAD + ((v - min) / range) * (size - 2 * PAD);
}

// map: {points: [{word, x, y, pos}], agreement: {neighbours, sharePct, chancePct}} from the corpus profile
export default function WordMap({map}) {
  const {points, agreement} = map;
  const [focus, setFocus] = useState(null); // highlighted part of speech
  const sx = scale(points.map((p) => p.x), W);
  const sy = scale(points.map((p) => p.y), H);
  const counts = Object.fromEntries(Object.keys(POS_COLOURS).map((pos) => [pos, points.filter((p) => p.pos === pos).length]));

  return (
    <>
      <p className="hint">
        The {points.length} most frequent words. Words preceded by similar words sit close together.
        {agreement && ` A word's ${agreement.neighbours} nearest neighbours share its part of speech ${agreement.sharePct}% of the time (${agreement.chancePct}% by chance), though the map was never told any grammar.`}
      </p>
      <div className="legend">
        {Object.entries(POS_COLOURS).filter(([pos]) => counts[pos]).map(([pos, colour]) => (
          <button key={pos} aria-pressed={focus === pos} onClick={() => setFocus(focus === pos ? null : pos)}>
            <span className="swatch" style={{background: colour}} aria-hidden="true" />
            {pos} <small>{counts[pos]}</small>
          </button>
        ))}
      </div>
      <div className="scroll">
        <svg width={W} height={H}>
          {points.map(({word, x, y, pos}) => (
            <g key={word} transform={`translate(${sx(x)} ${sy(y)})`} opacity={focus && pos !== focus ? 0.15 : 1}>
              <title>{`${word}: ${pos ?? 'untagged'}`}</title>
              <circle r="4" fill={POS_COLOURS[pos] ?? UNTAGGED} />
              <text x="7" dominantBaseline="middle">{word}</text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
