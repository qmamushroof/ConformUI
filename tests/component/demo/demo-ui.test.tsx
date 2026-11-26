import { LoadFixedButton, SampleBanner, TrySampleButton } from '@demo';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

describe('TrySampleButton', () => {
  it('SPEC-DEMO-02: one click calls onTry', () => {
    const onTry = vi.fn();
    render(<TrySampleButton onTry={onTry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try the sample' }));
    expect(onTry).toHaveBeenCalledTimes(1);
  });
  it('SPEC-DEMO-02: busy disables it so re-clicks cannot double-create', () => {
    const onTry = vi.fn();
    render(<TrySampleButton onTry={onTry} busy />);
    const b = screen.getByRole('button', { name: 'Try the sample' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onTry).not.toHaveBeenCalled();
  });
});

describe('SampleBanner', () => {
  it('SPEC-DEMO-04: shows the pre-computed label and the live action', () => {
    const onAllowLive = vi.fn();
    render(<SampleBanner onAllowLive={onAllowLive} />);
    expect(screen.getByText('Sample results (pre-computed)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Allow cloud to judge live' }));
    expect(onAllowLive).toHaveBeenCalledTimes(1);
  });
  it('SPEC-DEMO-05: without a handler there is no action; detail is replaceable', () => {
    render(<SampleBanner detail="Cloud is paused." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Cloud is paused.')).toBeTruthy();
  });
});

describe('LoadFixedButton', () => {
  it('SPEC-DEMO-04: calls onLoad; busy disables', () => {
    const onLoad = vi.fn();
    const { rerender } = render(<LoadFixedButton onLoad={onLoad} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load fixed implementation' }));
    expect(onLoad).toHaveBeenCalledTimes(1);
    rerender(<LoadFixedButton onLoad={onLoad} busy />);
    fireEvent.click(screen.getByRole('button', { name: 'Load fixed implementation' }));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
