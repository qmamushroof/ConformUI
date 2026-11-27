import { ensureAppCheckToken, type FirebaseApp } from '@fb';
import type { AiRequest, AiResponse, Clock, EngineStatus, RuntimeConfig } from '@kernel';
import { aiDebug, CuiError } from '@kernel';
import { AIError } from 'firebase/ai';
import { bytesSentFor, createModelFactory, engineFromSource, ON_DEVICE_MODEL_NAME } from './model-factory';
import { outputSchemaFor } from './schema-for';

// SPEC-AI-02, SPEC-AI-06, SPEC-AI-08..11: guards, one validated retry, timeouts and the error map around one request.
// The on-device wait is `on_device_timeout_s` (default 180 s): Gemma 4 with an image took 46 s on a Medium-class device.
// The cloud wait is `cloud_timeout_s` (default 120 s): a 239 KB Deep Analysis request was still unanswered at 59 s.

const RETRY_SUFFIX = '\nReturn only valid JSON matching the schema.';
const BLOCKING_FINISH = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION']);

export interface RunnerDeps {
  app: FirebaseApp;
  config: RuntimeConfig;
  clock: Clock;
  /** Device and connectivity facts (SPEC-AI-07). Only called for modes that may use the device. */
  status: () => Promise<EngineStatus>;
  /** The shared model factory (SPEC-AI-03); the runner builds its own when omitted. */
  factory?: ReturnType<typeof createModelFactory>;
  /** Connectivity for the cloud-only path; defaults to `navigator.onLine`. */
  online?: () => boolean;
  /** Resolves when App Check holds a token (SPEC-AI-14); defaults to the Firebase App Check token for `app`. */
  appCheckToken?: (forceRefresh: boolean) => Promise<void>;
  /** The wait before the one transport retry (SPEC-AI-14); defaults to 600 ms. */
  pause?: () => Promise<void>;
}

interface SdkResponse {
  text(): string;
  inferenceSource?: string;
  candidates?: { finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Raised inside the attempt loop for output that failed to parse or validate; triggers the single retry. */
class BadOutput extends Error {}

function isAbortLike(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

function isAppCheckFailure(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && code.startsWith('appCheck/')) return true;
  return typeof message === 'string' && /app[ -]?check/i.test(message);
}

/** A failure that never reached a model answer and may clear on a second try: App Check or the network. */
function isNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  return e instanceof AIError && e.code === 'fetch-error' && e.customErrorData?.status === undefined;
}

export function createRunner(d: RunnerDeps) {
  const appCheckToken = d.appCheckToken ?? ((force: boolean) => ensureAppCheckToken(d.app, force));
  const pause = d.pause ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 600)));
  const factory = d.factory ?? createModelFactory({ app: d.app, config: d.config });
  const isOnline = d.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  /** SPEC-AI-10. Never forwards SDK text to the UI. */
  function mapError(e: unknown, mode: AiRequest['mode']): CuiError {
    if (e instanceof CuiError) return e;
    if (e instanceof AIError) {
      const status = e.customErrorData?.status;
      if (e.code === 'api-not-enabled') {
        return mode === 'ONLY_ON_DEVICE'
          ? new CuiError('DEVICE_UNAVAILABLE', undefined, { cause: e })
          : new CuiError('AI_NOT_ENABLED', undefined, { cause: e });
      }
      if (e.code === 'unsupported' && mode === 'ONLY_ON_DEVICE') {
        return new CuiError('DEVICE_UNAVAILABLE', undefined, { cause: e });
      }
      if (status === 429) return new CuiError('QUOTA_EXCEEDED', undefined, { cause: e });
      if (status === 401 || status === 403) return new CuiError('APPCHECK_FAILED', undefined, { cause: e });
      if (e.code === 'fetch-error' && !isOnline()) return new CuiError('OFFLINE', undefined, { cause: e });
    }
    // App Check failures reach us as FirebaseError (`appCheck/throttled` after a 403 throttles the token for 24 h) or as
    // an SDK error whose text names App Check; neither carries an HTTP status here.
    if (isAppCheckFailure(e)) return new CuiError('APPCHECK_FAILED', undefined, { cause: e });
    // SPEC-AI-10 verified 2026-11-26 (spike A4): both default cloud ids answered ONLY_IN_CLOUD (gemini-3.5-flash-lite 2.3-7 s, gemini-3.8-flash 21 s).
    // One transient HTTP 500 "high demand" was seen; it falls to AI_FAILED, which SPEC-AI-08 treats as retryable. No change.
    return new CuiError('AI_FAILED', undefined, { cause: e });
  }

  /** Resolves to whether the device can answer this request, so the caller can pick the wait (SPEC-AI-08). */
  async function guardPreCall(req: AiRequest, hasImages: boolean): Promise<boolean> {
    const cloudCapable = req.mode !== 'ONLY_ON_DEVICE';
    // SPEC-AI-02 (a)
    if (cloudCapable) {
      const scope = req.consent?.scope;
      if (!scope || (req.task === 'deep-analysis' && scope !== 'deep')) throw new CuiError('CONSENT_REQUIRED');
    }
    // SPEC-AI-11
    for (const image of req.images) {
      if ((image.mime as string) !== 'image/jpeg' && (image.mime as string) !== 'image/png') {
        throw new CuiError('IMAGE_UNSUPPORTED');
      }
      if (image.base64.startsWith('data:')) throw new CuiError('IMAGE_UNSUPPORTED');
    }
    // SPEC-AI-09
    if (cloudCapable && !d.config.get().cloud_enabled) throw new CuiError('CLOUD_DISABLED');
    if (req.mode === 'ONLY_IN_CLOUD') {
      if (!isOnline()) throw new CuiError('OFFLINE');
      return false;
    }
    const status = await d.status();
    const deviceUsable = status.device === 'available' && (!hasImages || status.deviceImage === true);
    if (req.mode === 'ONLY_ON_DEVICE') {
      // SPEC-AI-02 (c): never start the silent waiting download.
      if (status.device === 'downloading') throw new CuiError('DEVICE_DOWNLOADING');
      if (status.device !== 'available') throw new CuiError('DEVICE_UNAVAILABLE');
      if (!deviceUsable) throw new CuiError('DEVICE_NO_IMAGE');
    } else if (!deviceUsable && !isOnline()) {
      throw new CuiError('OFFLINE');
    }
    return deviceUsable;
  }

  /** SPEC-AI-08: one SDK call with a timeout and the caller's signal; always cleans up. */
  async function callSdk(
    model: { generateContent(c: never, o: { signal: AbortSignal }): Promise<{ response: SdkResponse }> },
    content: unknown,
    timeoutMs: number,
    external: AbortSignal | undefined,
    engine: 'on-device' | 'cloud',
  ): Promise<SdkResponse> {
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctl.abort();
        reject(new CuiError('AI_TIMEOUT', 'The AI took too long', { engine }));
      }, timeoutMs);
      onAbort = () => {
        ctl.abort();
        reject(new CuiError('AI_FAILED', 'The AI request was cancelled'));
      };
      external?.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const result = await Promise.race([model.generateContent(content as never, { signal: ctl.signal }), guard]);
      return result.response;
    } finally {
      clearTimeout(timer);
      if (onAbort) external?.removeEventListener('abort', onAbort);
    }
  }

  /**
   * SPEC-AI-14: a cloud call first makes sure App Check has a token, and an App Check or network failure is retried once
   * with a forced token refresh. A timeout, a cancel, a quota or content error and every on-device call is never retried.
   */
  async function send(
    model: Parameters<typeof callSdk>[0],
    content: unknown,
    timeoutMs: number,
    external: AbortSignal | undefined,
    onDevice: boolean,
    mode: AiRequest['mode'],
  ): Promise<SdkResponse> {
    if (onDevice) return callSdk(model, content, timeoutMs, external, 'on-device');
    for (let retry = 0; ; retry++) {
      try {
        try {
          await appCheckToken(retry > 0);
        } catch (e) {
          if (isAppCheckFailure(e)) throw e;
          throw Object.assign(new Error('App Check token unavailable'), {
            code: 'appCheck/token-unavailable',
            cause: e,
          });
        }
        return await callSdk(model, content, timeoutMs, external, 'cloud');
      } catch (e) {
        const transient =
          !(e instanceof CuiError) && (isNetworkFailure(e) || mapError(e, mode).code === 'APPCHECK_FAILED');
        if (retry > 0 || !transient || external?.aborted || !isOnline()) throw e;
        await pause();
      }
    }
  }

  function readJson(task: AiRequest['task'], response: SdkResponse): unknown {
    // SPEC-AI-10: blocked or empty candidates.
    const first = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || !first || BLOCKING_FINISH.has(first.finishReason ?? '')) {
      throw new CuiError('AI_BLOCKED');
    }
    let text: string;
    try {
      text = response.text();
    } catch (e) {
      throw new CuiError('AI_BLOCKED', undefined, { cause: e });
    }
    aiDebug(`raw response text (${task})`, text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadOutput();
    }
    const checked = outputSchemaFor(task).safeParse(parsed);
    if (!checked.success) throw new BadOutput();
    return checked.data;
  }

  async function run(req: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    if (signal?.aborted) throw new CuiError('AI_FAILED', 'The AI request was cancelled');
    const hasImages = req.images.length > 0;
    const deviceUsable = await guardPreCall(req, hasImages);

    const started = d.clock.now();
    try {
      const { model } = factory.get({
        mode: req.mode,
        task: req.task,
        system: req.system,
        promptVersion: req.promptVersion,
        hasImages,
      });
      // PREFER_ON_DEVICE may be answered by the device, so it waits as long as the device needs when the device is usable.
      const onDevice = req.mode === 'ONLY_ON_DEVICE' || (req.mode === 'PREFER_ON_DEVICE' && deviceUsable);
      const values = d.config.get();
      const timeoutMs = (onDevice ? values.on_device_timeout_s : values.cloud_timeout_s) * 1000;
      const images = req.images.map((i) => ({ type: 'inlineData', inlineData: { mimeType: i.mime, data: i.base64 } }));
      let payloadBytes = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        const user = attempt === 0 ? req.user : req.user + RETRY_SUFFIX;
        const content = [{ type: 'text', text: user }, ...images];
        try {
          const response = await send(model as never, content, timeoutMs, signal, onDevice, req.mode);
          // Bytes are counted once an answer came back: a call that failed before or at the proxy sent nothing usable.
          payloadBytes += bytesSentFor('cloud', { system: req.system, user, images: req.images });
          // SPEC-AI-04, SPEC-AI-02 (b): throws AI_FAILED for a missing source or an ONLY_ON_DEVICE cloud result.
          const engine = engineFromSource(response.inferenceSource, req.mode);
          if (req.mode === 'ONLY_ON_DEVICE' && engine !== 'on-device') throw new CuiError('AI_FAILED');
          const json = readJson(req.task, response);
          return {
            json,
            engine,
            model: engine === 'on-device' ? ON_DEVICE_MODEL_NAME : factory.get(specOf(req, hasImages)).modelName,
            durationMs: d.clock.now() - started,
            bytesSent: engine === 'cloud' ? payloadBytes : 0,
            requestedMode: req.mode,
          };
        } catch (e) {
          const retryable = e instanceof BadOutput || (e instanceof AIError && e.code === 'parse-failed');
          if (!retryable || signal?.aborted) throw e;
          if (attempt === 1) throw new CuiError('AI_BAD_OUTPUT', undefined, { cause: e });
        }
      }
      throw new CuiError('AI_BAD_OUTPUT');
    } catch (e) {
      if (isAbortLike(e)) throw new CuiError('AI_FAILED', undefined, { cause: e });
      throw mapError(e, req.mode);
    }
  }

  return { run };
}

function specOf(req: AiRequest, hasImages: boolean) {
  return { mode: req.mode, task: req.task, system: req.system, promptVersion: req.promptVersion, hasImages };
}
