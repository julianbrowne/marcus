import {X} from 'lucide-react';

export default function Modal({title, onClose, children}) {
  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <dialog open aria-label={title}>
        <button className="close" aria-label="close" onClick={onClose} autoFocus><X aria-hidden="true" /></button>
        <h2>{title}</h2>
        {children}
      </dialog>
    </div>
  );
}
