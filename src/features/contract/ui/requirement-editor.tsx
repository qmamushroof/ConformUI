import type { Category, CheckSpec, CheckType, ManualRequirementDraft, Requirement, ViewportId } from '@kernel';
import { type FC, useId, useRef, useState } from 'react';
import { Icon } from './icon';
import { CATEGORY_TEXT } from './requirement-row';
import { Sheet } from './sheet';

export interface RequirementEditorProps {
  viewport: ViewportId;
  /** Viewports offered in the select (default Desktop and Mobile). */
  viewports?: ViewportId[];
  requirement?: Requirement;
  onSave(draft: ManualRequirementDraft): void;
  onCancel(): void;
}

const VIEWPORT_TEXT: Record<ViewportId, string> = {
  desktop: 'Desktop 1440',
  mobile: 'Mobile 390',
  tablet: 'Tablet 768',
};
const CATEGORIES = Object.keys(CATEGORY_TEXT) as Category[];
const TYPES: { id: CheckType; text: string; help: string }[] = [
  { id: 'measured', text: 'Measured', help: 'Numbers from the DOM snapshot or the image, on this device.' },
  { id: 'visual', text: 'Visual', help: 'Compares the design and capture images in the region.' },
  { id: 'judged', text: 'Judged', help: 'An AI model decides. The finding names its engine.' },
];

/** A check the Run can execute for each manual check type (SPEC-CON-05). */
function checkFor(type: CheckType, statement: string): CheckSpec {
  if (type === 'judged') return { kind: 'judged', question: statement };
  if (type === 'visual') return { kind: 'region-diff' };
  return { kind: 'presence', match: { text: statement } };
}

/** Add requirement sheet (SPEC-CON-08). Focus starts on the statement; Esc and Cancel discard. */
export const RequirementEditor: FC<RequirementEditorProps> = ({
  viewport,
  viewports = ['desktop', 'mobile'],
  requirement,
  onSave,
  onCancel,
}) => {
  const id = useId();
  const first = useRef<HTMLTextAreaElement>(null);
  const [statement, setStatement] = useState(requirement?.statement ?? '');
  const [condition, setCondition] = useState(requirement?.condition ?? '');
  const [vp, setVp] = useState<ViewportId>(viewport);
  const [category, setCategory] = useState<Category>(requirement?.category ?? 'presence');
  const [type, setType] = useState<CheckType>(requirement?.checkType ?? 'measured');
  const [errors, setErrors] = useState<{ st?: string; cond?: string }>({});

  const submit = () => {
    const st = statement.trim();
    const cond = condition.trim();
    const e: { st?: string; cond?: string } = {};
    if (!st) e.st = 'Write what must be true, in one sentence.';
    else if (st.length > 160) e.st = 'Keep the statement to 160 characters or fewer.';
    if (!cond) e.cond = 'Say when it passes, for example “Width is 202–238 px”.';
    else if (cond.length > 200) e.cond = 'Keep the condition to 200 characters or fewer.';
    setErrors(e);
    if (e.st || e.cond) return;
    onSave({ viewport: vp, category, statement: st, condition: cond, checkType: type, check: checkFor(type, st) });
  };

  return (
    <Sheet labelledBy={`${id}-h`} onClose={onCancel} initialFocus={first}>
      <form
        style={{ display: 'contents' }}
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <div className="sheet-head">
          <div className="stack-sm">
            <h2 id={`${id}-h`}>Add requirement</h2>
            <p className="muted small">
              Write one checkable fact about the design. It is added as accepted and labelled “Added by you”.
            </p>
          </div>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onCancel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="field">
          <label htmlFor={`${id}-st`}>Statement</label>
          <textarea
            ref={first}
            className="textarea"
            id={`${id}-st`}
            rows={2}
            style={{ minHeight: 0 }}
            value={statement}
            aria-invalid={errors.st ? true : undefined}
            aria-describedby={`${id}-st-help${errors.st ? ` ${id}-st-err` : ''}`}
            placeholder="Pricing link is in the header navigation"
            onChange={(e) => setStatement(e.target.value)}
          />
          <p className="help" id={`${id}-st-help`}>
            Plain words. Numbers belong in the condition.
          </p>
          {errors.st ? (
            <p className="error" id={`${id}-st-err`}>
              <Icon name="alert" small />
              {errors.st}
            </p>
          ) : null}
        </div>
        <div className="two" style={{ gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor={`${id}-vp`}>Viewport</label>
            <select className="select" id={`${id}-vp`} value={vp} onChange={(e) => setVp(e.target.value as ViewportId)}>
              {viewports.map((v) => (
                <option key={v} value={v}>
                  {VIEWPORT_TEXT[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-cat`}>Category</label>
            <select
              className="select"
              id={`${id}-cat`}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_TEXT[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">Check type</legend>
          {TYPES.map((t) => (
            <label className="choice" key={t.id}>
              <input type="radio" name={`${id}-ctype`} checked={type === t.id} onChange={() => setType(t.id)} />
              <span>{t.text}</span>
              <span className="help">{t.help}</span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-cond`}>Passes when</label>
          <input
            className="input"
            id={`${id}-cond`}
            value={condition}
            aria-invalid={errors.cond ? true : undefined}
            aria-describedby={errors.cond ? `${id}-cond-err` : undefined}
            placeholder="The header nav contains a link with the text “Pricing”"
            onChange={(e) => setCondition(e.target.value)}
          />
          {errors.cond ? (
            <p className="error" id={`${id}-cond-err`}>
              <Icon name="alert" small />
              {errors.cond}
            </p>
          ) : null}
        </div>
        <p className="small muted">No region yet. Visual checks on this requirement compare the whole viewport.</p>
        <div className="sheet-foot">
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" small />
            Add requirement
          </button>
        </div>
      </form>
    </Sheet>
  );
};
