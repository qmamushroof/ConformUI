# 4.12 settings

**[◀ 4.11 demo](04-11-DEMO.md)** · [SPEC index](../SPEC.md) · **[4.13 app + PWA ▶](04-13-APP-PWA.md)**

`src/features/settings` (kernel only). Engine panel, enable guide, model download, mode, consent revoke, privacy counter, clear data, onboarding. Realises PRD-F-11, PRD-F-12.2, PRD-H-03..H-06, PRD-P-06, PRD-P-09. Engine status comes from the `AiEngine` port (passed in).

## 4.12.1 Public API

```ts
export interface SettingsService {
  read(): Promise<Settings>; setMode(m: Settings['mode']): Promise<void>; markOnboarded(): Promise<void>;
  engine(): Promise<EngineView>; downloadModel(onProgress: (p01: number) => void): Promise<EngineView>;  // click handler only
  clearAllData(): Promise<void>;                                   // confirm happens in UI
  privacy(project?: Project): PrivacyView;
}
export interface EngineView { device: EngineStatus['device']; headline: string; detail: string; canDownload: boolean;
  imageOnDevice: boolean | 'unknown'; enableSteps?: string[]; online: boolean; cloud: 'enabled' | 'disabled'; mode: Settings['mode'] }
export type PrivacyView = { kind: 'nothing-sent'; text: 'Nothing has left this device' } | { kind: 'sent'; requests: number; bytes: number; text: string };
/** Projects with cloud consent, for the consent list (SPEC-SET-05). */
export function consentList(projects: Project[]): { projectId: string; name: string; grantedAt: number }[];
export function createSettingsService(d: { store: SettingsStore; ai: AiEngine; projects: ProjectStore; clock: Clock }): SettingsService;
export const SettingsScreen, EnginePanel, EngineBadge, PrivacyCounter, OnboardingScreen, ConsentSheet: React.FC<…>;
```

`ConsentSheet` (project consent, PRD-H-05) lives here because it is reused by contract and run screens through `app`; props: `sends: SendList`, `onAllow(ev)`, `onDecline()`.

## 4.12.2 Rules

| ID | Rule |
|---|---|
| `SPEC-SET-01` | Engine panel text per status (PRD-F-11.1, PRD-H-06), copied from the prototype `settings.html`. `available`: "On-device model ready: first pass stays on this device" + "Gemma 4 in Chrome on this computer. Contract extraction and judged checks run here unless you choose otherwise.", Image input "On" ("Not checked" when unknown); `available` with image off, or `unavailable` with `no-prompt-api` / `image-flag-off`: "On-device image input is off" + "Chrome has the model, but image input is turned off, so it can’t read designs yet. Text-only steps still run here.", Image input "Off", and `enableSteps`; `downloadable`: "On-device model not downloaded" + "Chrome can run Gemma 4 on this computer once the model is downloaded." + **Download model** (`canDownload`), Image input "On, after download"; `downloading`: "Downloading NN%" (`role="progressbar"`) + "Chrome is downloading Gemma 4. You can keep working; the download continues in the background." + "You can use the cloud meanwhile, with your consent. Measured and Visual checks work now."; `unavailable` `not-desktop-chrome`: "On-device AI needs desktop Chrome. ConformUI uses the cloud here, after you allow it per project." + "This browser has no on-device model. Measured and Visual checks still run on this device.", Image input "Not available"; other reasons (no prototype state): `chrome-too-old` "Update Chrome to 139 or later", `hardware` "Chrome reports this device can't run the model". Also: Cloud "reachable / offline / paused", current mode. The prototype's "Chrome 139" is left out of the ready and flag details because the Chrome version that ships Gemma 4 is unconfirmed. The header Engine pill (`SPEC-APP-02`) follows the same states. |
| `SPEC-SET-02` | `enableSteps`, the prototype's four steps (copy-paste; `chrome://` links cannot be opened by a page, so the user copies them): 1 "Open `chrome://flags/#prompt-api-multimodal-input` and `chrome://flags/#gemma4-for-built-in-ai`" (each address has its own Copy button) 2 "Set both to Enabled" (Copy button copies "Enabled") 3 "Relaunch Chrome" 4 "Come back and press Download model". The prototype names only the multimodal flag; the Gemma 4 flag (PRD-D-33) is added inside steps 1 and 2, so the step count and order stay as in the prototype. On the demo Chrome both flags are required. Verified (spike A1, 2026-11-26): with the multimodal flag off the image availability is `unavailable` (reason `image-flag-off`, so `enableSteps` show); no further flags are needed beyond these two. |
| `SPEC-SET-03` | Download (PRD-F-11.2): `downloadModel` calls `AiEngine.downloadDeviceModel` from the click; progress shown 0–100 %; failures → `DEVICE_UNAVAILABLE` copy. Model download is never started automatically. |
| `SPEC-SET-04` | Mode (PRD-F-11.3, PRD-H-04): radio **Auto** (default) / **Cloud only**; [P1] **On-device only**. Each option explains its mapping in one line ("Auto: on-device; cloud only for projects you allow"). Changing mode applies to the next request. |
| `SPEC-SET-05` | Consent list: every Project with cloud consent, with **Revoke** (PRD-F-11.3). Revoke takes effect immediately; the next first-pass request asks again. |
| `SPEC-SET-06` | Privacy counter (PRD-F-11.5): persistent in the header. `everSentToCloud === false` → "Nothing has left this device". Otherwise, inside a Project: "Cloud: n requests · X KB this project" (0 for this Project shows "Nothing from this project has left this device", returned as `kind:'sent'` with `requests: 0`; `privacy()` without a Project returns `nothing-sent`; the header decides from `everSentToCloud`). Updated from `TraceStep` cloud bytes. Click opens the Project's engine trace list. `app` sets `everSentToCloud = true` on the first `TraceStep` with engine `cloud`; `clearAllData` resets it. |
| `SPEC-SET-07` | Clear all data (PRD-F-11.4): confirm dialog naming what is deleted ("All projects, images, contracts and runs on this device"); clears stores except `deepUsage`; resets mode and onboarding; does not unregister the service worker. |
| `SPEC-SET-08` | Onboarding (PRD-F-12.2): one screen, shown until dismissed: the loop (Contract → Run → Fix prompt → Re-verify, 4 icons), the three engines (On-device / Cloud / Measured, one line each), privacy statement (PRD §6 table, exact wording in `copy.ts`); primary **Try the sample**, secondary **Start a project**; "Download on-device model" offered when `canDownload`. |
| `SPEC-SET-09` | `EngineBadge` (PRD-P-06, PRD-H-03): text label always visible — "On-device", "Cloud", "Measured" (+ "Rule (Measured)", "Pre-computed", "Sample (verified)", "Added by you" for non-engine origins), distinct icon per engine, `aria-label` "Produced by on-device model" etc. Used on every Requirement, Finding and Run trace row (PRD-M-04). |
| `SPEC-SET-10` | Cut rule (PRD §11 item 12): if this module's screen is cut, `EngineBadge`, the Download button + `enableSteps` (in the Project header) and `PrivacyCounter` remain. |
| `SPEC-SET-11` | Settings screen layout (prototype `settings.html`): sections Engine, Mode, Cloud consent, Privacy, Data, About with a section nav. About shows the version from `package.json` with the short commit after it (for example `1.0.1 (e2b6a69)`), the licence, and a Source link that always points to the repository (build-time `VITE_REPO_URL`, with a constant fallback; never a placeholder), and a Theme select (System / Light / Dark) that sets `data-theme` on `html` and is remembered in `localStorage` key `cui-theme` (a per-viewer convenience; blocked storage falls back to System). The Data section and the clear sheet show what is stored when `app` passes a usage summary. A failed `setMode`, revoke or clear is reported in plain language and changes nothing. Screens take services as props (`SettingsService`, project loader, revoke callback); `OnboardingScreen` takes the privacy rows from `copy.ts` as a prop because features never import `app`. |

## 4.12.3 Acceptance tests

Component: each `EngineStatus` → expected headline/steps; progressbar values; privacy counter states; badge label coverage. E2E (fake): revoke consent → next Extract asks again with zero calls before Allow; clear data empties Projects and keeps the Deep cap count.
