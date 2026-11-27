# 15. Polish and Accessibility

**[◀ 14. Integration](14-INTEGRATION.md)** · [Roadmap index](../ROADMAP.md) · **[16. Release ▶](16-RELEASE.md)**

| | |
|---|---|
| **Depends on** | M3; 15.3 also needs 2.6, 2.7. Budget 0.75 h (C 0.5, A 0.25), Day 3 |
| **Delivers** | Axe on every screen, keyboard and reflow pass, CSP enforced and proven on Hosting, performance and Lighthouse numbers |
| **Read** | SPEC §5.3–5.5, §6.2 (SPEC-SEC-08), §6.3, §8.1 |
| **Covers** | SPEC-UI-04, SPEC-UI-06, SPEC-SEC-08, SPEC-PERF-04, SPEC-PERF-07, SPEC-PERF-08, PRD-P-08, PRD-P-12, PRD-M-11, PRD §11 item 13 |

Fix defects in the owning module, never in the test.

### 15.1 E12: axe and keyboard · C · 0.3 h · needs M3
- [x] `@axe-core/playwright` on Projects, Project, Contract, Run, Finding detail, Settings, Onboarding, Snippet, light and dark (SPEC-UI-06).
- [x] Keyboard-only E1 and E4 (sheets trap focus, Esc, focus return).

**Accept:** zero serious/critical violations (PRD-M-11); keyboard specs green.

### 15.2 Manual a11y and polish pass · C · 0.2 h · needs 15.1
- [x] 320 px and 200 % zoom without page scroll; `prefers-reduced-motion`; screen reader on the core flow (announcements, crop `alt`; roles and live regions checked in `polish15.spec.ts`, a real screen-reader pass remains for a human).
- [x] Vocabulary matches PRD §8 exactly (PRD-D-19); every state has its copy (SPEC-UI-05); no chat input (PRD-P-08); progress within 100 ms and repeat clicks ignored (SPEC-PERF-08).

**Accept:** checklist ticked in the PR; defects fixed.

### 15.3 CSP on Hosting (D1) and performance · A · 0.25 h · needs 2.6, 2.7, 4.5
- [x] Add the SPEC-SEC-08 CSP (with any 4.5 amendment) as `Content-Security-Policy-Report-Only` in `firebase.json`; Human runs `npx firebase hosting:channel:deploy preview --expires 7d` (SPEC §8.1).
- [ ] Human: add the preview channel host to the reCAPTCHA key domains and the API-key referrers. Keep the channel id `preview` so the host stays stable (SPEC §8.3 step 2).
- [ ] Verify zero `script-src` `eval` violations on Hosting (zod jitless from 7.1; spike 4.5 saw one without it). A remaining one means the config ran after the kernel schemas were built.
- [ ] On the preview: one Deep Analysis and one on-device image prompt; zero violations → switch to enforced `Content-Security-Policy`; redeploy preview and repeat once.
- [ ] Lighthouse (DevTools) on the preview: record scores (SPEC-PERF-07, advisory); size check green (SPEC-PERF-04).

**Fallback:** a violation that cannot be fixed by an origin → apply the 4.5 fallback and record the `S#`; never ship without `default-src` and `object-src 'none'`.
**Accept:** enforced CSP, zero violations on both prompts; scores noted for 16.2.

## Exit gate

- No serious/critical axe issue; CSP enforced on the preview; numbers recorded.
