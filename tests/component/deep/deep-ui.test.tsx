import { DeepAnalysisButton, DeepConfirmSheet } from '@deep';
import { mintConsent } from '@kernel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const sends = {
  images: [{ label: 'Design, Desktop (1024 px)', bytes: 118 * 1024 }],
  text: ['Contract: 19 requirements'],
};

describe('DeepAnalysisButton', () => {
  it('SPEC-DEEP-01: opens the sheet on click when available', () => {
    const onOpen = vi.fn();
    render(<DeepAnalysisButton onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deep Analysis' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    'Deep Analysis needs a connection; your results are kept.',
    'Daily limit reached. Try tomorrow.',
    'Cloud analysis is paused.',
    'Nothing needs a deeper look.',
  ])('SPEC-DEEP-04, PRD-F-06.3: disabled shows reason "%s" and does not open', (reason) => {
    const onOpen = vi.fn();
    render(<DeepAnalysisButton disabledReason={reason} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: 'Deep Analysis' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(reason)).toBeTruthy();
    expect(btn.getAttribute('aria-describedby')).toBe(screen.getByText(reason).id);
    fireEvent.click(btn);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('SPEC-DEEP-01: no aria-disabled when available', () => {
    render(<DeepAnalysisButton onOpen={vi.fn()} />);
    expect(screen.getByRole('button').hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('DeepConfirmSheet', () => {
  it('SPEC-DEEP-01: Cancel has the default focus', () => {
    render(<DeepConfirmSheet sends={sends} onSend={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('SPEC-DEEP-02: lists every image and text line, total, model and usage', () => {
    render(
      <DeepConfirmSheet
        sends={sends}
        onSend={vi.fn()}
        onCancel={vi.fn()}
        targetCount={1}
        model="gemini-2.5-pro"
        usage={{ used: 1, cap: 5 }}
        totalBytes={412 * 1024}
      />,
    );
    expect(screen.getByText('Design, Desktop (1024 px)')).toBeTruthy();
    expect(screen.getByText('118 KB')).toBeTruthy();
    expect(screen.getByText('Contract: 19 requirements')).toBeTruthy();
    expect(screen.getByText('412 KB')).toBeTruthy();
    expect(screen.getByText('gemini-2.5-pro')).toBeTruthy();
    expect(screen.getByText('1 of 5 used')).toBeTruthy();
    expect(screen.getByText(/Cloud refines the 1 finding that needs review/)).toBeTruthy();
    expect(screen.getByText(/Google Gemini through Firebase/)).toBeTruthy();
  });

  it('SPEC-DEEP-02: empty list shows a 0 KB total; plural target copy', () => {
    render(<DeepConfirmSheet sends={{ images: [], text: [] }} onSend={vi.fn()} onCancel={vi.fn()} targetCount={3} />);
    expect(screen.getByText('0 KB')).toBeTruthy();
    expect(screen.getByText(/the 3 findings that need review/)).toBeTruthy();
  });

  it('SPEC-DEEP-01: a synthetic click (isTrusted:false) cannot mint consent', () => {
    const minted: unknown[] = [];
    const onSend = (ev: { isTrusted: boolean }) => {
      try {
        minted.push(mintConsent({ scope: 'deep', runId: 'r1' }, ev));
      } catch {
        /* CONSENT_REQUIRED */
      }
    };
    render(<DeepConfirmSheet sends={sends} onSend={onSend} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Send to cloud/ }));
    expect(minted).toHaveLength(0);
  });

  it('SPEC-DEEP-01: Send passes the click event up; a trusted event mints a deep token', () => {
    const onSend = vi.fn();
    render(<DeepConfirmSheet sends={sends} onSend={onSend} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Send to cloud/ }));
    const ev = onSend.mock.calls[0]?.[0] as Event;
    expect(ev.type).toBe('click');
    expect(ev.isTrusted).toBe(false);
    expect(() => mintConsent({ scope: 'deep', runId: 'r1' }, ev)).toThrow();
    expect(mintConsent({ scope: 'deep', runId: 'r1' }, { isTrusted: true }).scope).toBe('deep');
  });

  it('SPEC-UI-06: Cancel, Close and Esc cancel and never send', () => {
    const onSend = vi.fn();
    const onCancel = vi.fn();
    render(<DeepConfirmSheet sends={sends} onSend={onSend} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(screen.getByRole('dialog', { hidden: true }), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onSend).not.toHaveBeenCalled();
  });
});
