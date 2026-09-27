import {useLayoutEffect, useRef, useState} from 'react';
import {POS_GROUPS, posColour} from './pos';

const ZOOM = 5; // spread points out; labels stay the same size (22px, see index.css)
const W = 800 * ZOOM;
const H = 600 * ZOOM;
const PAD = 40;

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

  // the canvas is several screens wide: open centred on the middle of the words, not the empty corner
  const scroller = useRef(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    const mid = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    el.scrollLeft = mid(points.map((p) => sx(p.x))) - el.clientWidth / 2;
    el.scrollTop = mid(points.map((p) => sy(p.y))) - el.clientHeight / 2;
  }, [points]); // sx, sy derive from points
  const counts = Object.fromEntries(Object.keys(POS_GROUPS).map((pos) => [pos, points.filter((p) => p.pos === pos).length]));

  return (
    <>
      <p className="hint">
        The {points.length} most frequent words. Words preceded by similar words sit close together.
        {agreement && ` A word's ${agreement.neighbours} nearest neighbours share its part of speech ${agreement.sharePct}% of the time (${agreement.chancePct}% by chance), though the map was never told any grammar.`}
      </p>
      <div className="legend">
        {Object.keys(POS_GROUPS).filter((pos) => counts[pos]).map((pos) => (
          <button key={pos} aria-pressed={focus === pos} onClick={() => setFocus(focus === pos ? null : pos)}>
            <span className="swatch" style={{background: posColour(pos)}} aria-hidden="true" />
            {pos} <small>{counts[pos]}</small>
          </button>
        ))}
      </div>
      <div className="scroll" ref={scroller}>
        <svg width={W} height={H}>
          {points.map(({word, x, y, pos}) => (
            <g key={word} transform={`translate(${sx(x)} ${sy(y)})`} opacity={focus && pos !== focus ? 0.15 : 1}>
              <title>{`${word}: ${pos ?? 'untagged'}`}</title>
              <circle r="7" fill={posColour(pos)} />
              <text x="12" dominantBaseline="middle">{word}</text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
