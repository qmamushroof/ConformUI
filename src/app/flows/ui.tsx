import {
  type FC,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// Small shared pieces of the cross-feature flows: toast, modal sheet, manual-copy sheet. Markup and classes follow
// design/prototype (`.toasts`, `.sheet`).

const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const CLOSE = 'M6 6l12 12M18 6L6 18';

/** The sprite's three-dot "more" icon (circles, not a path). */
export const MORE_DOTS = 'more';

export const Glyph: FC<{ d: string; small?: boolean }> = ({ d, small }) => (
  <svg className={small ? 'i i-sm' : 'i'} aria-hidden="true" viewBox="0 0 24 24">
    {d === MORE_DOTS ? (
      <>
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="19" cy="12" r="1.2" />
      </>
    ) : (
      <path d={d} />
    )}
  </svg>
);

/** Polite status line shown briefly (the prototype toast). */
export function useToast(): [string, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [msg, show];
}

export const Toasts: FC<{ message: string }> = ({ message }) => (
  <div className="toasts" role="status" aria-live="polite">
    {message ? (
      <div className="toast">
        <Glyph d={CHECK} small />
        <span>{message}</span>
      </div>
    ) : null}
  </div>
);

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Modal sheet: native `dialog`, focus trap, Esc, focus returns to the trigger (SPEC-UI-06). */
export const Sheet: FC<{
  labelledBy: string;
  onClose(): void;
  initialFocus: RefObject<HTMLElement | null>;
  wide?: boolean;
  children: ReactNode;
}> = ({ labelledBy, onClose, initialFocus, wide, children }) => {
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
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className={wide ? 'sheet wide' : 'sheet'}
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

export const CloseButton: FC<{ onClick(): void }> = ({ onClick }) => (
  <button className="iconbtn" type="button" aria-label="Close" onClick={onClick}>
    <Glyph d={CLOSE} />
  </button>
);

/** Shown when the clipboard refuses: the text is selected so the person can copy it by hand (SPEC §4.10). */
export const ManualCopySheet: FC<{ text: string; onClose(): void }> = ({ text, onClose }) => {
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => area.current?.select(), []);
  return (
    <Sheet labelledBy="manual-copy-h" onClose={onClose} initialFocus={area}>
      <div className="sheet-head">
        <div className="stack-sm">
          <h2 id="manual-copy-h">Copy this text</h2>
          <p className="muted small">The browser blocked copying. The text is selected: press Ctrl+C or Cmd+C.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="field">
        <label htmlFor="manual-copy-t">Text</label>
        <textarea className="textarea code" id="manual-copy-t" ref={area} rows={12} readOnly value={text} />
      </div>
      <div className="sheet-foot">
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
};
