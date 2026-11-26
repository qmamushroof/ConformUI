import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './icon';

/** Polite status line shown briefly, like the prototype toast. */
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
        <Icon name="check" small />
        <span>{message}</span>
      </div>
    ) : null}
  </div>
);
