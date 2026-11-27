# Audit: interactive controls

Every control was traced to its handler. "Sample" and "Own" say whether it works on the sample project and on a project the person created. Own-project flow end to end (fake engine, real storage and measure): `tests/e2e/non-sample-flow.spec.ts`.

| Screen | Control | What it does | Sample | Own | Test |
|---|---|---|---|---|---|
| Header | Engine, Privacy links | Open Settings anchors | yes | yes | shell.spec |
| Onboarding | Try the sample / Start a project | Create sample, or go to Projects | yes | n/a | e1-two-clicks, projects.spec |
| Projects | New project, Rename, Delete, Export contract, Reload | Project CRUD, contract download | yes | yes | projects.spec, component |
| Project | Design, Capture pickers, drop, paste | Store the image | yes | yes | inputs.spec |
| Project | Paste snapshot | Validate and attach DOM snapshot | yes | yes | non-sample-flow |
| Project | Run | Run the active contract against captures | yes | yes | non-sample-flow |
| Contract | Extract contract, Stop extracting | Extract (own project: becomes active; sample: draft) | yes | yes | error-states, non-sample-flow |
| Contract | Accept all (notice and list head), per-item Accept | Mark accepted, count updates, toast "Accepted N requirements" | yes | yes | contract-ui, non-sample-flow |
| Contract | Edit, Delete, Add requirement | Review edits, toast "Saved / Deleted / Added" | yes | yes | contract-ui |
| Contract | Use AI contract, Keep verified contract | Adopt or discard the draft, toast | yes | n/a (own extraction is active at once) | non-sample-flow |
| Contract | Edit as v2 | Unlock a locked contract into the next version | yes | yes | non-sample-flow |
| Contract | Export contract MD/JSON | Download | yes | yes | non-sample-flow |
| Run | Findings list, viewport filter, Diff overlay, Full page | Select, filter, toggle evidence | yes | yes | non-sample-flow |
| Run | Copy fix prompt, Preview fix prompt, Copy run ID, Copy selector | Clipboard and toast | yes | yes | exports.spec, non-sample-flow |
| Run | Export report MD/JSON | Copy or download | yes | yes | exports.spec, non-sample-flow |
| Run | Deep Analysis sheet | Cloud refine after consent | yes | yes | deep-analysis.spec |
| Run | Re-verify sheet, Replace capture, Run Re-verify | New Run on new captures | yes | yes | reverify.spec, non-sample-flow |
| Run | Load fixed implementation | Loads the sample fixed captures | yes | hidden (sample only, by design) | sample-flow |
| Run | Allow cloud to judge live | Consent then re-judge | yes | n/a | sample-flow |
| Settings | Engine download, consent revoke, Clear all data | Engine status, privacy, wipe | yes | yes | settings.spec |
| Shell | Update toast Reload | Activate the new service worker | yes | yes | shell.test |

Findings:
- Accept all worked but gave no visible feedback on the Contract screen (no toast existed there). Fixed.
- The Deep Analysis "refined" notice used a broken info glyph and was not spaced from the next notice. Fixed.
- No dead controls found. "Compare with another run" is P1 and not present.
- Left as is: the Re-verify sheet copy ("Use the sample's fixed captures...") is the prototype's text and also shows on own projects; a replaced capture has no snapshot until one is pasted on the project page.
