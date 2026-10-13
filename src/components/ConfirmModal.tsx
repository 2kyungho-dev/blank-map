import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, body, confirmLabel, cancelLabel = '취소', onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);
  cancelFn.current = onCancel;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancelFn.current(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  return (
    <div className="modalback" onClick={onCancel}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
        <h2 id="modal-title"><span aria-hidden="true">⚠</span> {title}</h2>
        <div className="modalbody">{body}</div>
        <div className="modalbtns">
          <button ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
