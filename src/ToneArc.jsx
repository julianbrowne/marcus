// Tone across the text: average sentence sentiment in equal slices from start to finish,
// as a diverging bar chart (blue above zero = positive, red below = negative).
const W = 1000;
const H = 150;

export default function ToneArc({arc}) {
  // the zero line sits where the data puts it, so a mostly positive text isn't half empty space
  const top = Math.max(0.02, ...arc); // floors keep a flat arc from filling the chart
  const bottom = Math.min(-0.02, ...arc);
  const y = (v) => ((top - v) / (top - bottom)) * H;
  const MID = y(0);
  const step = W / arc.length;
  const describe = (i, v) =>
    `${Math.round((100 * i) / arc.length)}–${Math.round((100 * (i + 1)) / arc.length)}% through: ` +
    `${v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral'} (${v > 0 ? '+' : ''}${v})`;

  return (
    <figure className="tone-arc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average sentence tone from the start of the text to the end">
        {arc.map((v, i) => {
          const h = Math.abs(y(v) - MID);
          return (
            <rect key={i} className={v >= 0 ? 'positive' : 'negative'}
              x={i * step + 1} width={step - 2} y={v >= 0 ? MID - h : MID} height={Math.max(h, 1)} rx="2">
              <title>{describe(i, v)}</title>
            </rect>
          );
        })}
        <line className="zero" x1="0" x2={W} y1={MID} y2={MID} />
      </svg>
      <figcaption>
        <span>start</span>
        <span><i className="swatch positive" /> more positive · <i className="swatch negative" /> more negative</span>
        <span>end</span>
      </figcaption>
    </figure>
  );
}
