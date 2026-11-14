import { useEffect, useRef } from 'react';

// Native <dialog>: focus is kept inside, the page behind is inert, and Esc closes it for free.
// Global shortcuts are switched off while any dialog is open (see useHotkeys).
export default function Modal({ className = '', label, onClose, onKeyDown, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={label}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === ref.current && ref.current.close()} // click on the backdrop
    >
      <div className="modal-inner">{children}</div>
    </dialog>
  );
}
