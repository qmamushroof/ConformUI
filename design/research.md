# Research: ConformUI (devtools, Standard, 6 exemplars)

Method note: docs pages fetched only. No live-app screenshots were taken because the review UIs are behind logins. Type and color were not inspected. Items marked (guess) are inferred.

| Exemplar | URL | Signature | Takeaway |
|---|---|---|---|
| Chromatic | chromatic.com/docs/review/ | Review has Pending/Passed state plus an explicit checklist (changeset approved, discussions resolved, reviewers approved); diff highlight can be toggled | Make "done" a visible checklist; diff overlay must be toggleable |
| Playwright Trace Viewer | playwright.dev/docs/trace-viewer | Actions list plus detail with evidence tabs (Errors, Log, Metadata, Attachments); red line on timeline at the failure | One finding opens to tabbed evidence; metadata (viewport, browser) is always one click away |
| Playwright image diff (Attachments tab) | same page | Diff, actual and expected images, with a slider overlay on the expected image | Offer 3 views (diff, actual, expected) plus a slider reveal |
| GitHub PR review | docs.github.com ... reviewing-proposed-changes | Per-file "Viewed" checkbox collapses the file and drives a header progress bar; the mark resets if the file changes; unified or split toggle | Reviewed-progress per Finding; reset it on re-verify |
| Applitools Eyes | applitools.com/platform/eyes/ | Visual AI vs raw pixels; match levels (Strict, Layout, ...); click a diff to see the CSS/DOM cause; groups identical changes; feeds results back to coding agents | Link each difference to a cause. Group repeated Findings. Same agent-loop thesis as ConformUI |
| Linear Triage | linear.app/docs/triage | Queue with accept/decline/duplicate/snooze on number keys 1/2/3/H | Fast keyboard disposition for Needs review items |
| Vercel (environments docs) | vercel.com/docs/deployments/environments | Named environments (Preview/Production) as a first-class label; promote without rebuilding | A source label (Engine) works when it is a small, consistent noun. Prefer verbs that don't redo work (guess: Re-verify reuses captures) |

Not fetched: Percy docs URL returned 404. Stripe, Supabase, Tailscale, Resend, Fly.io and Honeycomb were not inspected, to stay within the fetch budget.

## Convergence (baseline, and the generic look to beat)
- List on the left, detail on the right, with tabbed evidence in the detail pane.
- A small set of status words, usually 2 states (Pending/Passed) or Pass/Fail. Color is the main cue.
- Three image views: side-by-side, diff highlight (often neon green or red), slider or toggle.
- A review "done" action (approve, resolve) tied to a check or gate.
- Metadata (viewport, browser) is shown as secondary text.

## Standouts
1. Done is a checklist, not a button (Chromatic). Principle: state what is outstanding.
2. Viewed progress that resets on change (GitHub). Principle: progress must be honest about staleness. Maps to Re-verify.
3. Diff + actual + expected + slider in one evidence tab (Playwright). Principle: the viewer picks the lens; the default is the one that explains the failure.
4. Differences link to a cause (Applitools: CSS rule or DOM element). Principle: evidence plus a reason is what builds trust. ConformUI's measured delta (e.g. 14px vs 16px) is the equivalent.
5. Number-key disposition (Linear). Principle: fast triage means few steps per item.

## Gaps
- No exemplar labels provenance per result (measured vs model-guessed). Applitools claims AI precision without showing the source per finding. ConformUI's Engine label (On-device/Cloud/Measured) is a differentiator to make prominent and honest.
- Review tools assume a baseline from a prior build. None model Explicit vs Inferred requirements or "Needs review" and "Not checked" as separate from Fail. Showing them distinctly is open ground.
- Re-run deltas (Resolved/Remaining/New/Regressed) are rarely shown as a summary bar. A segmented bar with counts is an opportunity (guess: not verified across tools).
- Mobile and narrow reflow of side-by-side review is weak in these desktop tools (guess).

## Implications
1. Layout: findings list plus evidence detail, becoming a stacked list-then-detail view at 320px. Evidence tabs or a segmented control: Side-by-side / Diff / Overlay slider, plus a toggle for the diff highlight. Default to side-by-side crops.
2. Show the Engine label as a labelled chip on every Finding. Write the words out ("Measured", "On-device", "Cloud"); never rely on color alone. Put the measured delta (design value, actual value, difference) next to the crops.
3. Summary bar at the top of a Run: segmented counts by status, severity as a secondary count. After Re-verify, swap in Resolved/Remaining/New/Regressed with the same bar form.
4. Provide a "Reviewed" mark per Finding with overall progress, cleared when Re-verify changes that Finding. Add a "Copy fix prompt" action fixed in the list header and per Finding.
5. Use a stepper with a completion checklist per step (Contract locked, captures added, Run done) so the next action is always stated. Empty states say what to drop and show one sample.
6. Use a muted palette. Brand blue is for primary actions only. Diff highlight is a neutral-safe pair such as magenta/amber, not neon, and is toggleable. Add keyboard shortcuts for next/previous Finding and mark reviewed.
