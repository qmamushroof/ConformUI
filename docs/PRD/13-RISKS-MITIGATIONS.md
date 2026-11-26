# 13. Risks and Mitigations

**[◀ 12. Success Metrics](12-SUCCESS-METRICS.md)** · [PRD index](../PRD.md) · **[14. Decisions Log ▶](14-DECISIONS-LOG.md)**

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | On-device model unavailable (browser, hardware, download pending) | Hybrid story weakens; first pass needs cloud | Cloud path first-class with consent (H-05); Engine status explains honestly; demo on prepared desktop Chrome; pre-computed sample results; fallback video |
| R-02 | False positives / negatives in Findings | Lost trust | Confidence on every Finding; Needs review status; Inferred capped at Minor; numbers only from engine; seeded sample with known defects (M-01) |
| R-03 | Gemma 4 on-device model too weak for reliable Contract extraction from a full-page image | Poor Contracts | Small discrete requests (per region or section) with schemas; user review/edit of the Contract; cloud fallback; prompts versioned via Remote Config |
| R-04 | Screenshot alignment fails (different heights, scroll offsets, DPR) | Wrong deltas | Scale-to-width and top alignment; DPR from snapshot; report misalignment instead of guessing (F-04.1); prefer DOM measurements where present |
| R-05 | Region matching between design and implementation is ambiguous | Wrong element compared | Engine snaps AI-suggested regions to detected element bounds (F-03.6); DOM selectors when snapshot present; low confidence → Needs review; demo sample ships a pre-authored, region-verified Contract (F-10.5); (P1) user-adjustable regions |
| R-06 | On-device token/image limits exceeded by large screenshots | Requests fail | Downscale/crop per request; fall back to cloud with consent; limits from SPEC (VERIFY) |
| R-07 | Cloud quota or cost abuse | Service stops | App Check; Deep Analysis user-initiated; Remote Config kill switch and model choice; on-device handles the bulk |
| R-08 | Audience and willingness to pay unproven | Weaker impact score | Keep claims modest (§4); demo grounded in a realistic agent-built page |
| R-09 | Novelty challenged by incumbents (Applitools, Percy, UI Inspect) | Weaker idea score | Differentiate on Contract, measured evidence, Inferred labelling, agent loop, privacy (§4) |
| R-10 | Prompt injection via text inside screenshots or snapshot | Manipulated output | Content treated as data; schema-constrained output; numbers never from the model |
| R-11 | DOM snippet captures sensitive page data | Privacy | Reads layout, text and styles only; never form values, cookies or storage (F-13.7); stays local unless user sends a Deep Analysis |
| R-12 | 3-day schedule with parallel agents | Incomplete polish | P0 order and cut line (§11); module boundaries enforced so agents work in parallel safely (D-03) |
| R-13 | Firebase hybrid API details differ from docs (field names, modes, SDK version) | Integration delays | VERIFY items in §7 checked at the first build step; isolate SDK behind a port (SPEC) |
| R-14 | Judges' Chrome lacks the multimodal flag (on-device image input off) | On-device path not seen live | Cloud path shown honestly after consent; in-app enable guide (F-11.1); text-only on-device checks where available (§7); demo video shows on-device |
