const ZOOM = 3; // spread points out; labels stay the same size
const W = 800 * ZOOM;
const H = 600 * ZOOM;
const PAD = 40;

function scale(values, size) {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return (v) => PAD + ((v - min) / range) * (size - 2 * PAD);
}

export default function WordMap({points}) {
  const sx = scale(points.map((p) => p.x), W);
  const sy = scale(points.map((p) => p.y), H);

  return (
    <>
      <p className="hint">The {points.length} most frequent words. Words preceded by similar words sit close together.</p>
      <div className="scroll">
        <svg width={W} height={H}>
          {points.map(({word, x, y}) => (
            <g key={word} transform={`translate(${sx(x)} ${sy(y)})`}>
              <circle r="2" />
              <text x="4" y="4">{word}</text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
