import type { Engine, Finding, Origin, Severity } from '@kernel';
import type { FC } from 'react';
import { Icon } from './icon';
import { ENGINE_TEXT, SEVERITY_TEXT } from './labels';

// Status, severity and engine are always icon plus word, never colour alone (SPEC-UI-04, PRD-P-12).

export const FailureStatus: FC<{ status: Finding['status'] }> = ({ status }) =>
  status === 'fail' ? (
    <span className="st st-fail">
      <Icon name="x" />
      Fail
    </span>
  ) : (
    <span className="st st-review">
      <Icon name="review" />
      Needs review
    </span>
  );

export const SeverityText: FC<{ severity: Severity }> = ({ severity }) => (
  <span className="sev">
    <Icon name={severity} />
    {SEVERITY_TEXT[severity]}
  </span>
);

const ENGINE_ICON = { 'on-device': 'chip', cloud: 'cloud', measured: 'ruler' } as const;

/** Engine of a Finding or trace step; a pre-computed sample answer is its own label (SPEC-DEMO-04). */
export const EngineText: FC<{ engine: Engine; origin?: Origin; label?: string }> = ({ engine, origin, label }) => {
  const pre = origin === 'precomputed';
  const text = pre ? 'Pre-computed' : ENGINE_TEXT[engine];
  return (
    <span className="eng" title={label ? `${label} ${text}` : undefined}>
      <Icon name={pre ? 'file' : ENGINE_ICON[engine]} />
      {text}
    </span>
  );
};
