import { ImageDropZone } from '@projects';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { png } from './shared';

afterEach(cleanup);

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('SPEC-PROJ-01, SPEC-PROJ-02, SPEC-UI-06: ImageDropZone', () => {
  it('SPEC-UI-06: is a keyboard-operable button that opens the file picker', () => {
    render(<ImageDropZone label="Drop the Desktop design, or choose a file" onFile={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Drop the Desktop design/ });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    const click = vi.spyOn(fileInput(), 'click');
    fireEvent.click(btn);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('SPEC-PROJ-02: prints the accepted formats and limits under the zone', () => {
    render(<ImageDropZone label="Add" onFile={vi.fn()} />);
    expect(screen.getByText(/PNG, JPEG or WebP, up to 20 MB and 8192 px per side/)).toBeTruthy();
    expect(fileInput().accept).toBe('image/png,image/jpeg,image/webp');
  });

  it('SPEC-PROJ-01: the file picker calls onFile once with the chosen file', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} />);
    const f = png();
    fireEvent.change(fileInput(), { target: { files: [f] } });
    expect(onFile).toHaveBeenCalledWith(f);
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('SPEC-PROJ-01: cancelling the picker (no file) does nothing', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} />);
    fireEvent.change(fileInput(), { target: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('SPEC-PROJ-01: dropping takes the first file and marks the zone while dragging over', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} />);
    const btn = screen.getByRole('button');
    fireEvent.dragOver(btn, { dataTransfer: { files: [png()] } });
    expect(btn.className).toContain('is-over');
    const [a, b] = [png('a.png'), png('b.png')];
    fireEvent.drop(btn, { dataTransfer: { files: [a, b] } });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(a);
    expect(btn.className).not.toContain('is-over');
  });

  it('SPEC-PROJ-01: a drop without files (text) is ignored', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} />);
    fireEvent.drop(screen.getByRole('button'), { dataTransfer: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('SPEC-PROJ-01: paste takes the first image/* item and ignores text items', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} />);
    const f = png('pasted.png');
    const item = (type: string, file: File | null) => ({ kind: file ? 'file' : 'string', type, getAsFile: () => file });
    fireEvent.paste(screen.getByRole('button'), {
      clipboardData: { items: [item('text/plain', null), item('image/png', f)] },
    });
    expect(onFile).toHaveBeenCalledWith(f);
    onFile.mockClear();
    fireEvent.paste(screen.getByRole('button'), { clipboardData: { items: [item('text/plain', null)] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('SPEC-UI-06: disabled blocks picker, drop and paste', () => {
    const onFile = vi.fn();
    render(<ImageDropZone label="Add" onFile={onFile} disabled />);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.drop(btn, { dataTransfer: { files: [png()] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it('SPEC-PROJ-02: an error is shown with an icon and marks the zone invalid', () => {
    render(<ImageDropZone label="Add" onFile={vi.fn()} error="landing-full.png is 12 480 px tall." />);
    expect(screen.getByRole('button').className).toContain('is-invalid');
    const err = screen.getByText(/12 480 px tall/).closest('.error');
    expect(err?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
