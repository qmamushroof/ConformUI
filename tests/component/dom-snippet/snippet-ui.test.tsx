import { DomSnapshotV1Schema } from '@kernel';
import { SNIPPET_VERSION, SnapshotPasteField, SnippetPanel, snippetSource } from '@snippet';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const snapshot = (width = 390, extra: Record<string, unknown> = {}) => ({
  schema: 'conformui.dom-snapshot',
  version: 1,
  snippetVersion: SNIPPET_VERSION,
  page: { url: 'https://example.test/', title: 'T' },
  capturedAt: '2026-11-25T10:00:00.000Z',
  viewport: { width, height: 844 },
  dpr: 2,
  document: { scrollWidth: width, scrollHeight: 900, clientWidth: width },
  overflow: { horizontal: false, horizontalPx: 0 },
  elements: [],
  truncated: false,
  ...extra,
});

describe('PRD-F-13.1, SPEC-SNIP-01: SnippetPanel', () => {
  it('SPEC-UI-06: has one h1 and three numbered steps as h2 headings', () => {
    render(<SnippetPanel onCopy={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'DOM snippet' })).toBeTruthy();
    const steps = within(screen.getByRole('list', { name: 'How to take a snapshot' })).getAllByRole('listitem');
    expect(steps.length).toBe(3);
    expect(steps.map((s) => s.querySelector('h2')?.textContent)).toEqual([
      'Open your page at the capture width',
      'Paste the snippet into the DevTools Console and press Enter',
      'Come back and choose Paste snapshot',
    ]);
  });

  it('PRD-F-13.1: shows the exact snippet source in a focusable, labelled code block with its version', () => {
    render(<SnippetPanel onCopy={vi.fn()} />);
    const pre = screen.getByLabelText('Snippet source code');
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.textContent).toBe(snippetSource);
    expect(screen.getByText(new RegExp(`v${SNIPPET_VERSION.replace(/\./g, '\\.')} · \\d+ lines`))).toBeTruthy();
  });

  it('PRD-F-13.1: Copy writes the unmodified source to the clipboard, then calls onCopy and says so', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopy = vi.fn();
    render(<SnippetPanel onCopy={onCopy} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));
    });
    expect(writeText).toHaveBeenCalledWith(snippetSource);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Snippet copied')).toBeTruthy();
  });

  it('PRD-F-13.1: when the clipboard is refused it does not claim success and selects the code instead', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    render(<SnippetPanel onCopy={onCopy} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));
    });
    expect(onCopy).not.toHaveBeenCalled();
    expect(screen.queryByText('Snippet copied')).toBeNull();
    expect(screen.getByText(/Select the code and copy it/)).toBeTruthy();
  });

  it('PRD-F-13.1: prints the privacy line, the what-it-reads disclosure and a disabled bookmarklet', () => {
    render(<SnippetPanel onCopy={vi.fn()} />);
    expect(screen.getByText('Reads layout, text and styles only; sends nothing')).toBeTruthy();
    expect(screen.getByText('What the snapshot contains').closest('details')).not.toBeNull();
    expect(screen.getByText('Never reads')).toBeTruthy();
    const bm = screen.getByRole('button', { name: /Bookmarklet \(coming later\)/ });
    expect(bm.getAttribute('aria-disabled')).toBe('true');
  });

  it('SPEC-UI-06: an optional back link names the project', () => {
    render(<SnippetPanel onCopy={vi.fn()} back={{ href: '/p/p1#captures', label: 'Back to Sample landing page' }} />);
    expect(screen.getByRole('link', { name: 'Back to Sample landing page' }).getAttribute('href')).toBe(
      '/p/p1#captures',
    );
  });
});

describe('SPEC-SNIP-08, PRD-F-13.5, PRD-F-13.6: SnapshotPasteField', () => {
  const paste = (text: string) => fireEvent.change(screen.getByLabelText('Snapshot JSON'), { target: { value: text } });

  it('SPEC-SNIP-08: a valid snapshot is accepted once, and equals the parsed snapshot', () => {
    const onAccept = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={onAccept} />);
    paste(JSON.stringify(snapshot()));
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(DomSnapshotV1Schema.safeParse(onAccept.mock.calls[0]?.[0]).success).toBe(true);
  });

  it('SPEC-SNIP-08: shows the 1 MB help text and the textarea is labelled', () => {
    render(<SnapshotPasteField viewport="desktop" cssWidth={1440} onAccept={vi.fn()} />);
    expect(screen.getByText('Up to 1 MB. Invalid snapshots are not stored.')).toBeTruthy();
    expect(screen.getByLabelText('Snapshot JSON').getAttribute('spellcheck')).toBe('false');
  });

  it('SPEC-SNIP-08: empty paste asks to paste first and accepts nothing', () => {
    const onAccept = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(screen.getByRole('alert').textContent).toContain('Nothing pasted. Run the snippet, then paste here.');
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('SPEC-SNIP-08: invalid JSON names the line', () => {
    const onAccept = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={onAccept} />);
    paste('{\n"schema": \n}}');
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Not valid JSON \(line \d+\)/);
    expect(screen.getByLabelText('Snapshot JSON').getAttribute('aria-invalid')).toBe('true');
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('SPEC-SNIP-08: a wrong version says it is not a snapshot v1', () => {
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={vi.fn()} />);
    paste(JSON.stringify(snapshot(390, { version: 2 })));
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(screen.getByRole('alert').textContent).toContain('This is not a ConformUI snapshot v1');
  });

  it('SPEC-SNIP-08, PRD-F-13.6: shows at most 5 messages with a count and what the run will do', () => {
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={vi.fn()} />);
    const bad = snapshot(390, { elements: Array.from({ length: 12 }, () => ({ i: 'x' })) });
    paste(JSON.stringify(bad));
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    const list = screen.getByRole('list', { name: 'Problems' });
    const n = within(list).getAllByRole('listitem').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    expect(screen.getByRole('alert').textContent).toContain('The run will use images only.');
  });

  it('SPEC-SNIP-08, PRD-F-13.6: oversized input shows the size message', () => {
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={vi.fn()} />);
    paste(`{"a":"${'x'.repeat(1024 * 1024 + 10)}"}`);
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Larger than 1 MB. Run the snippet again; it trims long text automatically.',
    );
  });

  it('SPEC-SNIP-08, PRD-F-13.5: a width mismatch warns first, then "Use anyway" accepts it', () => {
    const onAccept = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={onAccept} />);
    paste(JSON.stringify(snapshot(412)));
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByText('The snapshot was taken at 412 px; the Mobile 390 capture is 390 px wide.')).toBeTruthy();
    expect(screen.getByText('Measurements are only exact when the widths match.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use anyway' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('SPEC-SNIP-08: editing after a warning clears it and asks again', () => {
    const onAccept = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={onAccept} />);
    paste(JSON.stringify(snapshot(412)));
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    paste(JSON.stringify(snapshot(390)));
    expect(screen.queryByRole('button', { name: 'Use anyway' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add snapshot' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('SPEC-SNIP-08: Cancel is offered when onCancel is given', () => {
    const onCancel = vi.fn();
    render(<SnapshotPasteField viewport="mobile" cssWidth={390} onAccept={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
