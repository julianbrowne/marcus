import {useLayoutEffect, useRef, useState} from 'react';
import {POS_GROUPS, posColour} from './pos';

const ZOOM = 5; // spread points out; labels stay the same size (22px, see index.css)
const W = 800 * ZOOM;
const H = 600 * ZOOM;
const DOT = 7; // marker radius
const LABEL_X = 12; // label starts this far right of its point
const MARGIN = 24; // clear space inside the canvas edges
// ponytail: SVG text can't be measured before it's drawn; 0.65em per character is generous for 22px Geist
const labelWidth = (word) => word.length * 22 * 0.65;

// words keep clear of the edges: a dot's width on the left, half a line above and below,
// and the longest label's width on the right (labels are drawn to the right of their point)
function scale(values, size, before, after) {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return (v) => before + ((v - min) / range) * (size - before - after);
}

export const edges = (points) => ({
  left: MARGIN + DOT,
  right: MARGIN + LABEL_X + Math.max(...points.map((p) => labelWidth(p.word))),
  top: MARGIN + 11, // half the 22px line
  bottom: MARGIN + 11,
});

// map: {points: [{word, x, y, pos}], agreement: {neighbours, sharePct, chancePct}} from the corpus profile
export default function WordMap({map}) {
  const {points, agreement} = map;
  const [focus, setFocus] = useState(null); // highlighted part of speech
  const {left, right, top, bottom} = edges(points);
  const sx = scale(points.map((p) => p.x), W, left, right);
  const sy = scale(points.map((p) => p.y), H, top, bottom);

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
              <circle r={DOT} fill={posColour(pos)} />
              <text x={LABEL_X} dominantBaseline="middle">{word}</text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
