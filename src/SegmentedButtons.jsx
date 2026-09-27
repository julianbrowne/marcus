// One button shape split into parts ("raw | clean | profile"); the part for the open view is pressed.
export default function SegmentedButtons({label, options, active, disabled, onSelect}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option} aria-pressed={active === option} disabled={disabled} onClick={() => onSelect(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}
