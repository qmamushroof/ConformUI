import { type FC, useId } from 'react';
import { Icon } from './icon';

/** Opens `DeepConfirmSheet`; `disabledReason` is the plain-language reason when unavailable (SPEC-DEEP-01). */
export interface DeepAnalysisButtonProps {
  disabledReason?: string;
  onOpen(): void;
}

/** Explicit action only (PRD-P-05). Unavailable: `aria-disabled` plus the reason as visible text (SPEC-DEEP-04, PRD-F-06.3). */
export const DeepAnalysisButton: FC<DeepAnalysisButtonProps> = ({ disabledReason, onOpen }) => {
  const reasonId = useId();
  return (
    <>
      <button
        className="btn btn-ghost"
        type="button"
        id="deep-btn"
        {...(disabledReason ? { 'aria-disabled': true, 'aria-describedby': reasonId } : {})}
        onClick={() => {
          if (!disabledReason) onOpen();
        }}
      >
        <Icon name="cloud" small />
        Deep Analysis
      </button>
      {disabledReason && (
        <p className="small muted" id={reasonId}>
          {disabledReason}
        </p>
      )}
    </>
  );
};
