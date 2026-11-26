import { CuiError, type DomSnapshot } from '@kernel';
import { ProjectHead, ProjectInputs } from '@projects';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capture, design, fakeService, png, project } from './shared';

afterEach(cleanup);

const dom = (n = 3, width = 390): DomSnapshot =>
  ({
    schema: 'conformui.dom-snapshot',
    version: 1,
    elements: Array.from({ length: n }, (_, i) => ({ i })),
    viewport: { width, height: 844 },
  }) as unknown as DomSnapshot;

type Props = ComponentProps<typeof ProjectInputs>;

function mount(p = project(), extra: Partial<Props> = {}) {
  const service = fakeService();
  const onChange = vi.fn();
  render(<ProjectInputs project={p} service={service} onChange={onChange} snippetHref="/snippet" {...extra} />);
  return { service, onChange };
}

const column = (name: string) => screen.getByRole('region', { name }) as HTMLElement;
const pick = (zone: HTMLElement, f: File) => {
  const input = zone.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [f] } });
};

describe('SPEC-PROJ-01, SPEC-UI-04: ProjectInputs columns', () => {
  it('SPEC-PROJ-01: shows one column per viewport with Design, Capture and DOM snapshot slots', () => {
    mount();
    expect(screen.getByRole('heading', { level: 2, name: 'Inputs' })).toBeTruthy();
    for (const name of ['Desktop 1440', 'Mobile 390']) {
      const col = column(name);
      expect(within(col).getByText('Design')).toBeTruthy();
      expect(within(col).getByText('Capture')).toBeTruthy();
      expect(within(col).getByText('DOM snapshot')).toBeTruthy();
    }
  });

  it('SPEC-PROJ-01: only the chosen viewports get a column', () => {
    mount(project(), { viewports: ['desktop'] });
    expect(screen.queryByRole('region', { name: 'Mobile 390' })).toBeNull();
  });

  it('SPEC-PROJ-02: every drop zone prints the formats and limits', () => {
    mount();
    expect(screen.getAllByText(/PNG, JPEG or WebP, up to 20 MB and 8192 px per side/).length).toBeGreaterThanOrEqual(1);
  });

  it('SPEC-PROJ-01: dropping a design in a column calls addDesign for that viewport and refreshes', async () => {
    const { service, onChange } = mount();
    const f = png('desktop.png');
    await act(async () => {
      pick(column('Desktop 1440'), f);
    });
    expect(service.addDesign).toHaveBeenCalledWith('p1', f, 'desktop');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('SPEC-PROJ-02: a rejected image shows the file name and reason as an alert and changes nothing', async () => {
    const { service, onChange } = mount();
    service.addDesign.mockRejectedValueOnce(
      new CuiError('IMAGE_TOO_LARGE', 'it is 1440 × 12 480 px, over the 8192 px limit'),
    );
    await act(async () => {
      pick(column('Desktop 1440'), png('landing-full.png'));
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'landing-full.png was not added: it is 1440 × 12 480 px, over the 8192 px limit',
    );
    expect(alert.textContent).toContain('Nothing else changed.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('SPEC-UI-04: an existing design shows its size and a labelled Replace button', () => {
    mount(project({ designs: [design('desktop')] }));
    const col = column('Desktop 1440');
    expect(within(col).getByText('1440 × 1000 · 312 KB')).toBeTruthy();
    expect(within(col).getByRole('button', { name: 'Replace Desktop design' })).toBeTruthy();
  });

  it('SPEC-PROJ-03: a viewport without a design says it is inferred and offers to add one', async () => {
    const { service } = mount(project({ designs: [design('desktop')] }));
    const col = column('Mobile 390');
    expect(within(col).getByText('None. Mobile requirements are inferred from Desktop.')).toBeTruthy();
    const f = png('m.png');
    fireEvent.change(col.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [f] } });
    await waitFor(() => expect(service.addDesign).toHaveBeenCalledWith('p1', f, 'mobile'));
  });

  it('SPEC-PROJ-02: a design thumbnail uses the supplied image source and has alt text', () => {
    mount(project({ designs: [design('desktop')] }), { imageSrc: (id) => `blob:${id}` });
    const img = within(column('Desktop 1440')).getByRole('img', { name: 'Desktop design' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:b-1440');
  });
});

describe('SPEC-PROJ-03, PRD-F-02.3: capture sheet', () => {
  const openSheet = (vp = 'Desktop 1440') => {
    const r = mount(project({ designs: [design('desktop')] }));
    fireEvent.click(within(column(vp)).getByRole('button', { name: /Add a (Desktop|Mobile) capture/ }));
    return r;
  };

  it('SPEC-UI-06: opens a labelled sheet with the column viewport selected and Add capture disabled until an image is chosen', async () => {
    openSheet('Mobile 390');
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    expect((within(dlg).getByLabelText('Mobile 390') as HTMLInputElement).checked).toBe(true);
    expect(within(dlg).getByRole('button', { name: 'Add capture' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('SPEC-PROJ-03, PRD-F-02.3: a chosen image prefills the viewport from suggestViewport and it can still be changed', async () => {
    const { service } = openSheet('Desktop 1440');
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    const f = png('Screenshot_1.png');
    await act(async () => {
      pick(dlg, f);
    });
    expect(service.suggestViewport).toHaveBeenCalledWith(f);
    expect((within(dlg).getByLabelText(/Mobile 390/) as HTMLInputElement).checked).toBe(true);
    expect(within(dlg).getByText(/Suggested/)).toBeTruthy();
    fireEvent.click(within(dlg).getByLabelText(/Desktop 1440/));
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Add capture' }));
    });
    expect(service.addCapture).toHaveBeenCalledWith('p1', f, 'desktop');
  });

  it('SPEC-PROJ-03: saves with the suggested viewport when left unchanged and refreshes', async () => {
    const { service, onChange } = openSheet('Desktop 1440');
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    const f = png('shot.png');
    await act(async () => {
      pick(dlg, f);
    });
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Add capture' }));
    });
    expect(service.addCapture).toHaveBeenCalledWith('p1', f, 'mobile');
    expect(onChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add capture' })).toBeNull());
  });

  it('SPEC-PROJ-03: if probing fails the column viewport stays selected and the image can still be added', async () => {
    const { service } = openSheet('Desktop 1440');
    service.suggestViewport.mockRejectedValueOnce(new CuiError('IMAGE_DECODE_FAILED'));
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    await act(async () => {
      pick(dlg, png('x.png'));
    });
    expect((within(dlg).getByLabelText(/Desktop 1440/) as HTMLInputElement).checked).toBe(true);
  });

  it('SPEC-PROJ-02: a capture the codec rejects is reported in the sheet and nothing is added', async () => {
    const { service, onChange } = openSheet('Desktop 1440');
    service.addCapture.mockRejectedValueOnce(
      new CuiError('IMAGE_DECODE_FAILED', 'it is not a PNG, JPEG or WebP image'),
    );
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    await act(async () => {
      pick(dlg, png('x.gif', 'image/gif'));
    });
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'Add capture' }));
    });
    expect(within(dlg).getByRole('alert').textContent).toContain(
      'x.gif was not added: it is not a PNG, JPEG or WebP image',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('SPEC-PROJ-01: pasting an image on the page opens the capture sheet with that image', async () => {
    const { service } = mount(project({ designs: [design('desktop')] }));
    const f = png('pasted.png');
    const item = { kind: 'file', type: 'image/png', getAsFile: () => f };
    await act(async () => {
      fireEvent.paste(screen.getByRole('heading', { name: 'Inputs' }), { clipboardData: { items: [item] } });
    });
    const dlg = await screen.findByRole('dialog', { name: 'Add capture' });
    expect(service.suggestViewport).toHaveBeenCalledWith(f);
    expect(within(dlg).getByText('pasted.png')).toBeTruthy();
  });
});

describe('SPEC-PROJ-04, PRD-F-02.6: stale notice', () => {
  const p = project({ designs: [design('desktop')], captures: [capture('desktop'), capture('mobile')] });

  it('SPEC-PROJ-04: shows "Captures changed: Re-verify" only on the replaced viewport', () => {
    mount(p, { stale: ['mobile'] });
    expect(within(column('Mobile 390')).getByText('Captures changed: Re-verify')).toBeTruthy();
    expect(within(column('Desktop 1440')).queryByText('Captures changed: Re-verify')).toBeNull();
  });

  it('SPEC-PROJ-04: shows nothing when no viewport is stale', () => {
    mount(p, { stale: [] });
    expect(screen.queryByText('Captures changed: Re-verify')).toBeNull();
  });

  it('SPEC-UI-04: the stale notice is icon plus text, never colour only', () => {
    mount(p, { stale: ['desktop'] });
    const el = screen.getByText('Captures changed: Re-verify');
    expect(el.closest('.st')?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('PRD-F-13.5, SPEC-SNIP-08: DOM snapshot slot', () => {
  it('PRD-F-13.5: no snapshot says measured DOM checks will be Not checked, with Paste snapshot and the snippet link', () => {
    mount(project({ captures: [capture('desktop')] }));
    const col = column('Desktop 1440');
    expect(within(col).getByText('No snapshot.')).toBeTruthy();
    expect(within(col).getByText(/Measured DOM checks will be Not checked/)).toBeTruthy();
    expect(within(col).getByRole('link', { name: 'Get the snippet' }).getAttribute('href')).toBe('/snippet');
    expect(within(col).getByRole('button', { name: /Paste snapshot/ })).toBeTruthy();
  });

  it('PRD-F-13.5: an added snapshot shows its element count and that it matches the capture', () => {
    mount(project({ captures: [capture('mobile', { dom: dom(187) })] }));
    const col = column('Mobile 390');
    expect(within(col).getByText('Snapshot added, 187 elements')).toBeTruthy();
    expect(within(col).getByText('390 × 844, matches the capture')).toBeTruthy();
  });

  it('PRD-F-13.5: a snapshot at another width says so instead of matching', () => {
    mount(project({ captures: [capture('mobile', { dom: dom(3, 412), warnings: ['dom-viewport-mismatch'] })] }));
    expect(within(column('Mobile 390')).getByText('412 × 844, differs from the capture')).toBeTruthy();
  });

  it('SPEC-UI-06: Paste snapshot is unavailable (with the reason) until that viewport has a capture', () => {
    mount(project());
    const btn = within(column('Desktop 1440')).getByRole('button', { name: /Paste snapshot/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('Add a capture first.').length).toBeGreaterThan(0);
  });

  it('SPEC-SNIP-08: Paste snapshot opens a sheet with the injected field for that viewport and width, and stores the result', async () => {
    const field = vi.fn(({ onAccept }: { onAccept(s: DomSnapshot): void }) => (
      <button type="button" onClick={() => onAccept(dom(5))}>
        stub add
      </button>
    ));
    const { service, onChange } = mount(project({ captures: [capture('mobile')] }), { snapshotField: field });
    fireEvent.click(within(column('Mobile 390')).getByRole('button', { name: /Paste snapshot/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Paste DOM snapshot, Mobile 390' });
    expect(field).toHaveBeenCalledWith(expect.objectContaining({ viewport: 'mobile', cssWidth: 390 }));
    await act(async () => {
      fireEvent.click(within(dlg).getByRole('button', { name: 'stub add' }));
    });
    expect(service.attachSnapshot).toHaveBeenCalledWith('p1', 'c-mobile', expect.objectContaining({ version: 1 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('SPEC-SNIP-08: the sheet links to the snippet and can be dismissed with its Close button', async () => {
    mount(project({ captures: [capture('mobile')] }), { snapshotField: () => <p>field</p> });
    fireEvent.click(within(column('Mobile 390')).getByRole('button', { name: /Paste snapshot/ }));
    const dlg = await screen.findByRole('dialog', { name: /Paste DOM snapshot/ });
    expect(within(dlg).getByRole('link', { name: 'Get the snippet' }).getAttribute('href')).toBe('/snippet');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('SPEC-UI-04: ProjectHead stepper', () => {
  it('SPEC-UI-04: shows the crumbs, the six steps in order, the current step and the next one', () => {
    render(<ProjectHead project={project({ isSample: true })} step="captures" done={3} next="run" />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByText('Sample')).toBeTruthy();
    const steps = within(screen.getByRole('list', { name: 'Project steps' })).getAllByRole('listitem');
    expect(steps.length).toBe(6);
    expect(steps.map((s) => s.textContent?.replace(/\d|\(done\)/g, '').trim())).toEqual([
      'Design',
      'Contract',
      'Captures',
      'Run, next',
      'Fix',
      'Re-verify',
    ]);
    expect(
      within(steps[2] as HTMLElement)
        .getByRole('link')
        .getAttribute('aria-current'),
    ).toBe('step');
    expect(steps[3]?.className).toContain('next');
    expect(steps[0]?.className).toContain('done');
    expect(steps[0]?.textContent).toContain('(done)');
    expect(steps[3]?.className).not.toContain('done');
  });

  it('SPEC-UI-04: step links point inside the project and the name is the crumb link', () => {
    render(<ProjectHead project={project()} step="design" done={0} next="design" />);
    expect(screen.getByRole('link', { name: 'Contract' }).getAttribute('href')).toBe('/p/p1/contract');
    expect(screen.getByRole('link', { name: 'Sample landing page' }).getAttribute('href')).toBe('/p/p1');
    expect(screen.getByRole('link', { name: 'Projects' }).getAttribute('href')).toBe('/');
  });
});
