import type { Finding, Requirement } from '@kernel';
import type { FC } from 'react';
import { ComparisonView, type EvidenceImage } from './comparison-view';
import { Icon } from './icon';
import { CONFIDENCE_TEXT, deltaText, sourceText, valueText } from './labels';
import { EngineText, FailureStatus, SeverityText } from './status';

export interface FindingDetailProps {
  finding: Finding;
  /** For the category in the meta line. */
  requirement?: Requirement;
  design?: EvidenceImage;
  capture?: EvidenceImage;
  diff?: EvidenceImage;
  /** Id of the heading, for `aria-labelledby` of the pane. */
  titleId?: string;
  /** Copies text and shows a toast; `app` owns the clipboard. */
  onCopyText?(text: string, toast: string): void;
}

const CATEGORY_TEXT: Record<Requirement['category'], string> = {
  presence: 'Presence',
  content: 'Text',
  position: 'Alignment',
  size: 'Size',
  spacing: 'Spacing',
  typography: 'Typography',
  colour: 'Colour',
  responsive: 'Responsive',
};

/** Right pane of the Run screen: statement, evidence, measurements, fix and pass condition (SPEC-UI-01, SPEC-RUN-07). */
export const FindingDetail: FC<FindingDetailProps> = ({
  finding: f,
  requirement,
  design,
  capture,
  diff,
  titleId = 'finding-title',
  onCopyText,
}) => {
  const review = f.status === 'needs-review';
  const ms = f.evidence.measurements;
  const selector = f.evidence.selector;
  return (
    <>
      <div className="stack-sm">
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <FailureStatus status={f.status} />
          {!review && <SeverityText severity={f.severity} />}
          {f.refinedBy && (
            <span className="refined">
              <Icon name="cloud" small />
              Refined by Cloud
            </span>
          )}
        </div>
        <h2 id={titleId} className="prose" tabIndex={-1}>
          {f.statement}
        </h2>
        <div className="meta">
          <span className="mono xs">{f.requirementId}</span>
          {requirement && <span>{CATEGORY_TEXT[requirement.category]}</span>}
          <span>
            {f.label === 'inferred' ? <span className="tag tag-dashed">Inferred (advisory)</span> : 'Explicit'}
          </span>
          <EngineText engine={f.engine} origin={f.origin} label="Produced by" />
          <span>{CONFIDENCE_TEXT[f.confidence]} confidence</span>
        </div>
      </div>

      <ComparisonView
        finding={f}
        nothingDrawn={requirement?.check.kind === 'presence'}
        {...(design && { design })}
        {...(capture && { capture })}
        {...(diff && { diff })}
      />

      {(ms.length > 0 || selector) && (
        <section className="sec" aria-labelledby={`${titleId}-m`}>
          <h3 id={`${titleId}-m`}>Measurements</h3>
          {ms.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th className="r">Design</th>
                    <th className="r">Implementation</th>
                    <th className="r">Difference</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m) => {
                    const diffText = deltaText(m);
                    const bad = !review && diffText !== '' && diffText !== '0';
                    return (
                      <tr key={`${m.name}-${m.source.observed}`}>
                        <td>{m.name}</td>
                        <td className="r">{valueText(m.design, m.unit)}</td>
                        <td className="r">{valueText(m.observed, m.unit)}</td>
                        <td className={`r${bad ? ' val-fail' : ''}`}>{diffText}</td>
                        <td className="muted">{sourceText(m)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {selector && (
            <div className="inline-code small">
              <span className="muted">Selector</span>
              <code>{selector}</code>
              <button
                type="button"
                className="iconbtn"
                aria-label="Copy selector"
                onClick={() => onCopyText?.(selector, 'Selector copied')}
              >
                <Icon name="copy" small />
              </button>
            </div>
          )}
        </section>
      )}

      <div className="two">
        <section className="sec">
          <h3>Suggested fix</h3>
          <p className="prose">{f.suggestedFix}</p>
        </section>
        <section className="sec">
          <h3>Passes when</h3>
          <p className="prose">{f.condition}</p>
        </section>
      </div>
    </>
  );
};
