import { type FC, type KeyboardEvent, type ReactNode, type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  /** Id of the heading that names the dialog. */
  labelledBy: string;
  /** Called for Esc and the native cancel; the parent unmounts the sheet. */
  onClose(): void;
  /** Element that receives focus first (the safe choice, SPEC-UI-06). */
  initialFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** Modal sheet: native `dialog`, Cancel-first focus, focus trap, Esc, focus returns to the trigger (SPEC-UI-06). */
export const Sheet: FC<SheetProps> = ({ labelledBy, onClose, initialFocus, children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dlg.open) {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    initialFocus.current?.focus();
    return () => {
      if (typeof dlg.close === 'function' && dlg.open) dlg.close();
      trigger?.focus();
    };
  }, [initialFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      aria-modal="true"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-in">{children}</div>
    </dialog>
  );
};
