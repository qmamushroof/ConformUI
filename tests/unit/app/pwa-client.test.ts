import { describe, expect, it, vi } from 'vitest';
import { createInstallPrompt, createUpdateFlow } from '../../../src/app/pwa';

// SPEC-PWA-02 install button state, SPEC-PWA-05 update toast state.
function installEvent() {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  return e;
}

describe('createInstallPrompt', () => {
  it('SPEC-PWA-02: unavailable until beforeinstallprompt, which is captured with preventDefault', () => {
    const target = new EventTarget();
    const p = createInstallPrompt(target);
    expect(p.canInstall()).toBe(false);
    const e = installEvent();
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(p.canInstall()).toBe(true);
  });
  it('SPEC-PWA-02: notifies subscribers on capture and stops after unsubscribe', () => {
    const target = new EventTarget();
    const p = createInstallPrompt(target);
    const fn = vi.fn();
    const off = p.subscribe(fn);
    target.dispatchEvent(installEvent());
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    target.dispatchEvent(installEvent());
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('SPEC-PWA-02: install() prompts once from the click, then clears the captured event', async () => {
    const target = new EventTarget();
    const p = createInstallPrompt(target);
    const e = installEvent();
    target.dispatchEvent(e);
    await expect(p.install()).resolves.toBe('accepted');
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(p.canInstall()).toBe(false);
    await expect(p.install()).resolves.toBe('unavailable');
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });
  it('SPEC-PWA-02: install() without a captured event is unavailable', async () => {
    await expect(createInstallPrompt(new EventTarget()).install()).resolves.toBe('unavailable');
  });
  it('SPEC-PWA-02: appinstalled hides the button', () => {
    const target = new EventTarget();
    const p = createInstallPrompt(target);
    target.dispatchEvent(installEvent());
    target.dispatchEvent(new Event('appinstalled'));
    expect(p.canInstall()).toBe(false);
  });
});

describe('createUpdateFlow', () => {
  function stubWb() {
    const handlers: Record<string, (() => void)[]> = {};
    return {
      addEventListener: (t: string, h: () => void) => {
        handlers[t] = [...(handlers[t] ?? []), h];
      },
      messageSkipWaiting: vi.fn(),
      fire: (t: string) => {
        for (const h of handlers[t] ?? []) h();
      },
    };
  }

  it('SPEC-PWA-05: not ready until the waiting event', () => {
    const wb = stubWb();
    const u = createUpdateFlow(wb);
    expect(u.ready()).toBe(false);
    wb.fire('waiting');
    expect(u.ready()).toBe(true);
  });
  it('SPEC-PWA-05: skipWaiting is sent only by reload(), never on waiting', () => {
    const wb = stubWb();
    const u = createUpdateFlow(wb);
    wb.fire('waiting');
    expect(wb.messageSkipWaiting).not.toHaveBeenCalled();
    u.reload();
    expect(wb.messageSkipWaiting).toHaveBeenCalledTimes(1);
  });
  it('SPEC-PWA-05: reload() before any waiting worker does nothing', () => {
    const wb = stubWb();
    createUpdateFlow(wb).reload();
    expect(wb.messageSkipWaiting).not.toHaveBeenCalled();
  });
  it('SPEC-PWA-05: page reloads on controlling after the user clicked, and not otherwise', () => {
    const wb = stubWb();
    const reloadPage = vi.fn();
    const u = createUpdateFlow(wb, reloadPage);
    wb.fire('controlling');
    expect(reloadPage).not.toHaveBeenCalled();
    wb.fire('waiting');
    u.reload();
    wb.fire('controlling');
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
  it('SPEC-PWA-05: notifies subscribers when ready', () => {
    const wb = stubWb();
    const u = createUpdateFlow(wb);
    const fn = vi.fn();
    u.subscribe(fn);
    wb.fire('waiting');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
