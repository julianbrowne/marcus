import {useEffect, useRef, useState} from 'react';

// a "view ▾" button with a menu of options; `label` names the button for screen readers
export default function ViewMenu({options, label, disabled, onSelect}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // close on any click outside the menu
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current.contains(e.target) || setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function choose(option) {
    setOpen(false);
    onSelect(option);
  }

  return (
    <div className="dropdown" ref={ref} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button onClick={() => setOpen(!open)} disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        view <span aria-hidden="true">▾</span>
      </button>
      {open && !disabled && (
        <div className="menu" role="menu">
          {options.map((option) => (
            <button key={option} role="menuitem" onClick={() => choose(option)}>{option}</button>
          ))}
        </div>
      )}
    </div>
  );
}
