export default function Modal({title, onClose, children}) {
  return (
    <div className="backdrop" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <dialog open aria-label={title}>
        <button className="close" aria-label="close" onClick={onClose} autoFocus>×</button>
        <h2>{title}</h2>
        {children}
      </dialog>
    </div>
  );
}
