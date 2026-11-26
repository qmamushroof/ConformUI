import type {
  Confidence,
  Engine,
  Evidence,
  Finding,
  Origin,
  Requirement,
  RequirementResult,
  Run,
  Severity,
  Status,
  ViewportId,
} from '@kernel';
import type { ResultOutcome } from './types';

// Severity, confidence, status, Findings and sort (SPEC-RUN-05..08, PRD-P-01, PRD-P-03, PRD-P-04, PRD-P-07).

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
const VIEWPORT_RANK: Record<ViewportId, number> = { desktop: 0, mobile: 1, tablet: 2 };
const CONFIDENCE_RANK: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

export const minConfidence = (a: Confidence, b: Confidence): Confidence =>
  CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;

/** SPEC-RUN-06: an Inferred item is never above Minor. */
export const capSeverity = (severity: Severity, label: Requirement['label']): Severity =>
  label === 'inferred' ? 'minor' : severity;

const MAX_TEXT = 400;
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** "Expected … (inferred)" wording (SPEC-RUN-06). */
function inferredLead(req: Requirement): string {
  const body = req.statement.replace(/\s*\(inferred\)\s*\.?$/i, '').replace(/[.\s]+$/, '');
  const lead = /^expected\b/i.test(body) ? body : `Expected ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  return `${lead} (inferred)`;
}

export interface BuildOptions {
  runId: string;
  req: Requirement;
  outcome: ResultOutcome;
  engine?: Engine;
  origin?: Origin;
}

/**
 * SPEC-RUN-07: a Finding exists for each `fail` and `needs-review` result, only for a Requirement. Low confidence is
 * `needs-review` (SPEC-RUN-06); evidence with neither crop is `needs-review` with "Evidence could not be produced"
 * (PRD-P-07).
 */
export function resultFromOutcome({
  runId,
  req,
  outcome: o,
  engine = 'measured',
  origin,
}: BuildOptions): RequirementResult {
  const base = { requirementId: req.id, viewport: req.viewport, engine, confidence: o.confidence };
  if (o.status === 'not-checked') {
    return {
      ...base,
      status: 'not-checked',
      ...(o.reason && { reason: o.reason }),
      ...(o.hint && { hint: o.hint }),
      ...(origin && { origin }),
    };
  }

  let status: Status = o.status;
  let statement = o.statement;
  if (status !== 'needs-review' && o.confidence === 'low') {
    status = 'needs-review';
    statement ??= `${req.statement}: only a low-confidence answer was possible, so confirm it by eye.`;
  }
  if (status === 'pass') return { ...base, status: 'pass', ...(origin && { origin }) };

  const { designCrop, captureCrop, diffRatio, selector, measurements } = o.facts;
  let hint = o.hint;
  if (!designCrop && !captureCrop) {
    status = 'needs-review';
    hint = 'Evidence could not be produced';
    statement = `${req.statement}: Evidence could not be produced, so this needs a manual check.`;
  }
  const evidence: Evidence = {
    measurements,
    ...(designCrop && { designCrop }),
    ...(captureCrop && { captureCrop }),
    ...(diffRatio !== undefined && { diffRatio }),
    ...(selector && { selector }),
  };
  const severity = capSeverity(o.severity ?? 'major', req.label);
  const text = statement ?? req.statement;
  const finding: Finding = {
    id: `${runId}:${req.id}:${req.viewport}`,
    requirementId: req.id,
    viewport: req.viewport,
    label: req.label,
    status: status === 'fail' ? 'fail' : 'needs-review',
    severity,
    confidence: o.confidence,
    engine,
    statement: clip(req.label === 'inferred' ? `${inferredLead(req)}. ${text}` : text),
    suggestedFix: clip(o.fix ?? 'Compare this area with the design and adjust it to match.'),
    condition: req.condition,
    evidence,
    origin: origin ?? req.origin,
  };
  return {
    ...base,
    status: finding.status,
    ...(hint && { hint }),
    finding,
    ...(origin && { origin }),
  };
}

const collator = new Intl.Collator('en', { numeric: true });

/** SPEC-RUN-08: severity, fail before needs-review, Explicit before Inferred, viewport, requirement id. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1) ||
    (a.label === b.label ? 0 : a.label === 'explicit' ? -1 : 1) ||
    VIEWPORT_RANK[a.viewport] - VIEWPORT_RANK[b.viewport] ||
    collator.compare(a.requirementId, b.requirementId)
  );
}

export function sortedFindings(run: Run): Finding[] {
  return run.results.flatMap((r) => (r.finding ? [r.finding] : [])).sort(compareFindings);
}
