# Handoff: finishing release 1.0.1

Status as of 2026-11-27. Read AGENTS.md and docs/ROADMAP.md first. The main session plans, reviews and merges, and subagents implement. Write failing tests first.

## Live

- Production: https://conformui.web.app runs main `8ddb022` (PR #70: About shows 1.0.1 and the repo link, new README, docs/SUBMISSION.md).
- Known prod bug: the offline installed app sometimes shows ROUTE_ERROR at `/`, `/settings` and `/?utm_source=pwa&homescreen=1`. It fails 5 of 15 runs of `tests/prod/prod-smoke.spec.ts:49`. A fix is in progress on `fix/offline-route-error`.

## Open branches (all pushed)

| Branch | Purpose | State |
|---|---|---|
| `fix/ui-sweep` (PR #71) | Clickables spec, touch targets, `/project` → `/` aliases, accurate 404 copy, in-app "Gemini Nano 4 (Gemma 4)" labels | CI failed on 2 tests. `clickables.spec.ts:177`: the About Source link must open in a new tab (add `target="_blank" rel="noopener noreferrer"` in `src/features/settings/ui/settings-screen.tsx`). `responsive.spec.ts:248`: investigate. Fix both, then merge. Put leftovers in `docs/UI-SWEEP.md` follow-ups. |
| `fix/offline-route-error` | Root-cause the offline ROUTE_ERROR above | Must pass `--repeat-each 10` at 100%, then merge |
| `release/phase14` | Re-record precomputed `extraction` and `deep` from real on-device logs; fixPrompt/reportMarkdown snapshots (14.3); 14.4 metrics; box-matching check; R-07 wrongly judged pass/high on-device; bump `APP_VERSION` in `src/features/export/format.ts` to 1.0.1; tick the roadmap | In progress. The live logs are in `demo-video/work/` on branch `handoff/context`. |
| `fix/webkit-storage` | IndexedDB stores `{bytes: ArrayBuffer, type}` instead of a Blob, so WebKit and iOS pass `npm run test:cross` with `CROSS_WEBKIT=1` | In progress. If it passes, enable WebKit and iPhone in CI and add them to the README Platforms matrix with positive wording. |
| `handoff/context` | This file plus the demo-video pipeline snapshot in `demo-video/` | Do not merge into main. It is reference only. |

## Deploy (after the merges)

```
git pull --ff-only origin main && rm -rf dist && npm ci && npm run build && node scripts/check-dist.mjs \
  && PROD_PORT=4831 npm run test:prod && npx firebase deploy --only hosting
```

- Use `set -o pipefail` and never pipe the test run through `tail` (it hid a failure once).
- Add `,remoteconfig` only if `remoteconfig.template.json` changed.
- Headless App Check 403s ("App attestation failed") come from the reCAPTCHA bot score in automated Chromium. They are expected.

## Remaining roadmap items

- 14.3 and 14.4: `release/phase14`.
- 16.5 hosted smoke: after the final deploy, check both inferenceSource values on https://conformui.web.app (on-device in Chrome with the flags, and cloud). Then tick it.
- 16.6 demo video: upload it to YouTube (owner account, public, English, ≤ 3:00). Replace `<!-- VIDEO_URL -->` in README.md (nav row and Demo video section) and "(YouTube link)" in docs/SUBMISSION.md. Then tick it.
- 16.7 rows still open: Working application, Supported platform, Demo video, Original, Not a chatbot.
- 17 (demo script) recording-setup items.
- Optional: a `v1.0.1` tag and GitHub release.

## Demo video (`demo-video/` on this branch)

- `out/conformui-demo.mp4` and `captions.srt` are the latest render. Check that it is the final cut: ≤ 3:00, logo intro and outro.
- `scripts/` holds the recording scripts. `rec.cjs` drives a headed Chrome with a dedicated profile, built by `setup-profile.cjs` with the flags `gemma4-for-built-in-ai@1` and `prompt-api-multimodal-input@1`. Recording on-device needs a local desktop with Chrome built-in AI, so it cannot run in a cloud session.
- `tts/` and `voiceover/`: the voice is am_michael (TTS) only. Never use the owner's voice.
- `build.cmd` and `record.cmd` contain local paths. Adjust them per machine.
- `script/`: the narration script. Beat 2 still has a "[N]/[M]" placeholder, and Beat 6 says "6 resolved, 1 remaining". Update both from the final run.
- `work/live-*.{log,json,txt}`: real on-device output (Gemma 4) with the `[ConformUI AI]` debug log.
- Staged beats must be listed in the video README. Only real app behaviour may be shown.

## Wording rules for docs and narration

- Model naming: "Gemini Nano 4 (Gemma 4)". Source: the Android Developers blog, "Announcing Gemma 4 in the AICore Developer Preview" (2 Apr 2026): "These models are the foundation for the next generation of Gemini Nano". That post covers Android AICore, not Chrome, so never claim Google says Chrome ships "Gemini Nano 4".
- No hedging lines ("not verified", "not tested on"). Stay accurate by leaving claims out. The one limitation, phrased as behaviour: "On-device in desktop Chrome; everywhere else the same app runs on cloud Gemini automatically."
- Multi-platform: one installable PWA for Windows, macOS, Linux, ChromeOS and Android (plus iOS once WebKit passes), offline-ready.

## Owner-only steps

1. Upload the video to YouTube.
2. Fill in the Devpost form from `docs/SUBMISSION.md`.
3. Optional: check real Safari or an iPhone.

## Constraints

- Never read, print or commit `.env.local`. Agents may only copy it.
- Never commit `dist/`.
- No personal details, and no AI or coding-tool names, in docs or commits.
- Delete the remote `spike/hybrid` only on owner confirmation.
- Merge green PRs with `gh pr merge N --merge --delete-branch`.
