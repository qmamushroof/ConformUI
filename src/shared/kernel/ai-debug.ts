// Opt-in diagnostic for AI behaviour: set localStorage "cui.debug.ai" to "1" and the app writes what the model
// returned and how boxes were mapped to the console. Off by default; no network, nothing stored.

export const AI_DEBUG_KEY = 'cui.debug.ai';
const PREFIX = '[ConformUI AI]';

export function aiDebugEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(AI_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

export function aiDebug(...args: unknown[]): void {
  // biome-ignore lint/suspicious/noConsole: the diagnostic is the console output, opt-in only
  if (aiDebugEnabled()) console.info(PREFIX, ...args);
}
