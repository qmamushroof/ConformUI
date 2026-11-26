// Client side of the PWA: install button state (SPEC-PWA-02) and update flow state (SPEC-PWA-05). Strings live in
// app/copy.ts; the header and toast components subscribe to these.

type Listener = () => void;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPrompt {
  canInstall(): boolean;
  subscribe(listener: Listener): () => void;
  /** Must be called from the user's click. */
  install(): Promise<InstallOutcome>;
}

function emitter() {
  const listeners = new Set<Listener>();
  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit() {
      for (const l of [...listeners]) l();
    },
  };
}

/** SPEC-PWA-02: capture `beforeinstallprompt`, show "Install app" while it is available. */
export function createInstallPrompt(target: EventTarget = window): InstallPrompt {
  let captured: BeforeInstallPromptEvent | null = null;
  const { subscribe, emit } = emitter();
  target.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    captured = e as BeforeInstallPromptEvent;
    emit();
  });
  target.addEventListener('appinstalled', () => {
    captured = null;
    emit();
  });
  return {
    canInstall: () => captured !== null,
    subscribe,
    async install() {
      const event = captured;
      if (!event) return 'unavailable';
      captured = null;
      await event.prompt();
      const { outcome } = await event.userChoice;
      emit();
      return outcome;
    },
  };
}

/** The slice of `workbox-window`'s `Workbox` the update flow uses. */
export interface UpdateWorkbox {
  addEventListener(type: 'waiting' | 'controlling', listener: () => void): void;
  messageSkipWaiting(): void;
}

export interface UpdateFlow {
  ready(): boolean;
  subscribe(listener: Listener): () => void;
  /** The toast's Reload click: the only place `skipWaiting` is requested (SPEC-PWA-05). */
  reload(): void;
}

export function createUpdateFlow(
  wb: UpdateWorkbox,
  reloadPage: () => void = () => window.location.reload(),
): UpdateFlow {
  let waiting = false;
  let requested = false;
  const { subscribe, emit } = emitter();
  wb.addEventListener('waiting', () => {
    waiting = true;
    emit();
  });
  wb.addEventListener('controlling', () => {
    if (requested) reloadPage();
  });
  return {
    ready: () => waiting,
    subscribe,
    reload() {
      if (!waiting) return;
      requested = true;
      wb.messageSkipWaiting();
    },
  };
}
