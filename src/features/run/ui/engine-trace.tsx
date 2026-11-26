import type { TraceStep } from '@kernel';
import type { FC } from 'react';
import { Icon } from './icon';
import { bytesText, durationText, plural, stepLabel } from './labels';
import { EngineText } from './status';

export interface EngineTraceProps {
  trace: readonly TraceStep[];
}

const isPre = (s: TraceStep) => s.note === 'pre-computed';

/** What ran, on which engine, for how long and how much left the device (PRD-H-05, SPEC-RUN-12). */
export const EngineTrace: FC<EngineTraceProps> = ({ trace }) => {
  const sent = trace.reduce((n, s) => n + (Number.isFinite(s.bytesSent) ? s.bytesSent : 0), 0);
  const requests = trace.filter((s) => s.engine === 'cloud' && s.bytesSent > 0).length;
  const aside =
    sent > 0
      ? `${bytesText(sent)} sent, ${plural(requests, 'cloud request', 'cloud requests')}`
      : '0 B sent off this device';
  return (
    <section className="runlevel" aria-labelledby="trace-h">
      <details className="disc" open>
        <summary>
          <Icon name="chev" small className="chev" />
          <span id="trace-h">Engine trace</span>
          <span className="aside">{aside}</span>
        </summary>
        <div className="table-wrap disc-body">
          <table className="data">
            <thead>
              <tr>
                <th>Step</th>
                <th>Engine</th>
                <th className="r">Duration</th>
                <th className="r">Sent off this device</th>
              </tr>
            </thead>
            <tbody>
              {trace.map((s, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: steps repeat names and never reorder
                <tr key={`${s.step}-${i}`}>
                  <td>{stepLabel(s.step)}</td>
                  <td>
                    <EngineText engine={s.engine} {...(isPre(s) && { origin: 'precomputed' as const })} />
                  </td>
                  <td className="r">{isPre(s) ? 'sample result' : durationText(s.durationMs)}</td>
                  <td className="r">{bytesText(s.bytesSent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};
