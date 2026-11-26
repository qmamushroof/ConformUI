import { ERROR_CODES } from '@kernel';
import { StateNotice } from '@projects';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stateCopy } from '../../../src/app/copy';

afterEach(cleanup);

describe('SPEC-UI-05: StateNotice renders the copy of every ErrorCode (E13)', () => {
  it.each(ERROR_CODES)('SPEC-UI-05, E13: %s shows its title, detail and code', (code) => {
    const n = stateCopy[code];
    render(<StateNotice notice={n} code={code} />);
    expect(screen.getByText(n.title)).toBeTruthy();
    if (n.detail) expect(screen.getByText(n.detail)).toBeTruthy();
    expect(screen.getByText(code)).toBeTruthy();
  });

  it.each(ERROR_CODES)('SPEC-UI-04, PRD-P-12: %s is announced by role, never by colour alone', (code) => {
    const n = stateCopy[code];
    render(<StateNotice notice={n} code={code} />);
    const region = screen.getByRole(n.tone === 'danger' ? 'alert' : 'status');
    expect(region.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(region.textContent).toContain(n.title);
  });
});

describe('SPEC-UI-05: StateNotice variants and a11y', () => {
  it('SPEC-UI-05: danger tone uses role alert and the notice-danger class', () => {
    render(<StateNotice notice={stateCopy.STORAGE_UNAVAILABLE} />);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('notice');
    expect(el.className).toContain('notice-danger');
  });

  it('SPEC-UI-05: info tone uses role status and notice-info', () => {
    render(<StateNotice notice={{ tone: 'info', title: 'Hello' }} />);
    expect(screen.getByRole('status').className).toContain('notice-info');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('SPEC-UI-05: neutral tone has no accent modifier', () => {
    render(<StateNotice notice={{ tone: 'neutral', title: 'Plain' }} />);
    const cls = screen.getByRole('status').className;
    expect(cls).toContain('notice');
    expect(cls).not.toContain('notice-danger');
    expect(cls).not.toContain('notice-info');
  });

  it('SPEC-UI-06: heading prop renders the title as the one h1, otherwise a paragraph', () => {
    const { rerender } = render(<StateNotice notice={stateCopy.NOT_FOUND} heading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(stateCopy.NOT_FOUND.title);
    rerender(<StateNotice notice={stateCopy.NOT_FOUND} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('SPEC-UI-05: action button appears only with onAction and calls it once', () => {
    const onAction = vi.fn();
    const { rerender } = render(<StateNotice notice={stateCopy.STORAGE_UNAVAILABLE} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<StateNotice notice={stateCopy.STORAGE_UNAVAILABLE} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('SPEC-UI-05: onAction without an action label renders no button', () => {
    render(<StateNotice notice={{ tone: 'info', title: 'T' }} onAction={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('SPEC-UI-05: omitted detail and code render no empty elements', () => {
    const { container } = render(<StateNotice notice={{ tone: 'info', title: 'Only a title' }} />);
    expect(container.querySelectorAll('p').length).toBe(1);
  });

  it('SPEC-UI-05, SPEC-SNIP-08: children render under the detail (problem list)', () => {
    render(
      <StateNotice notice={stateCopy.SNAPSHOT_INVALID} code="SNAPSHOT_INVALID">
        <ul>
          <li>viewport.width: missing</li>
        </ul>
      </StateNotice>,
    );
    expect(screen.getByText('viewport.width: missing')).toBeTruthy();
  });

  it('SPEC-UI-07: rendered text has no em dash for any code', () => {
    for (const code of ERROR_CODES) {
      const { container, unmount } = render(<StateNotice notice={stateCopy[code]} code={code} />);
      expect((container.textContent ?? '').includes('—')).toBe(false);
      unmount();
    }
  });
});
