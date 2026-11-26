# 6. Storage and Imaging

**[◀ 5. Firebase and AI Engine](05-A-FIREBASE-AI.md)** · [Roadmap index](../ROADMAP.md) · **[7. App Shell and PWA ▶](07-A-APP-PWA.md)**

| | |
|---|---|
| **Depends on** | G0. Budget 1.25 h, lane A, Day 2 morning |
| **Delivers** | `platform/storage` (`openStorage`), `platform/imaging` (`createImageCodec`) |
| **Read** | SPEC §4.6.3, §4.4.2, §4.1.3 (ports), §6.3 (SPEC-PERF-03) |
| **Covers** | SPEC-STORE-01..05, SPEC-MEAS-01..04 (probe), SPEC-PERF-03, PRD-F-01.1, PRD-F-02.2, PRD-F-02.4, PRD-P-11 |

Until this merges (M2), features use the in-memory stores from 3.6. Touches only `src/platform/storage`, `src/platform/imaging` and their tests.

### 6.1 openStorage · A · 0.75 h · needs G0
- [x] DB `conformui` v1, stores and indexes, upgrade switch, newer-DB read-only (SPEC-STORE-01).
- [x] `ProjectStore`, `BlobStore`, `SettingsStore` implementations; one-transaction cascade `remove`; `clearAll` keeps `deepUsage` (SPEC-STORE-02).
- [x] zod-validated reads, invalid record skipped and counted (SPEC-STORE-03); `STORAGE_UNAVAILABLE` (open fails) and `STORAGE_FAILED` mapping and one-time `persist()` (SPEC-STORE-04); no network (SPEC-STORE-05).

**Accept:** SPEC §4.6.4 storage tests with `fake-indexeddb`: round trip per store, cascade leaves no orphan blobs, corrupt record skipped, `clearAll` keeps `deepUsage`, newer version read-only, open failure (stubbed `indexedDB.open` error) → `CuiError` `STORAGE_UNAVAILABLE` with no store touched.

### 6.2 createImageCodec · A · 0.5 h · needs G0
- [ ] `normalise`: accepted MIME and limits, decode, resample to `cssWidth`, height cap, PNG output (SPEC-MEAS-01, SPEC-MEAS-02).
- [ ] `pixels`, `crop` (JPEG for AI, PNG for evidence, base64 without prefix), `composePair` (SPEC-MEAS-03).
- [ ] `probe(file)`: source width, height and MIME without resampling, for `suggestViewport` (SPEC-MEAS-04, SPEC-KERNEL-12).

**Accept:** unit tests with stubbed `createImageBitmap`/`OffscreenCanvas` for limit errors, size math and pair layout; real decode proven by E8 (14.3); SPEC-PERF-03 timed once manually in 14.4.

## Exit gate

- `npm run check:fast` green; `idb` imported only here (depcruise `idb-confined`).
- Merged at M2.
