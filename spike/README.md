# VERIFY spikes 4.2 to 4.5 (throwaway branch `spike/hybrid`, never merged, never pushed)

Worktree: `C:\Users\SN-LP-64\source\repos\qmamushroof\ConformUI-spike`. Firebase config is read from the main checkout's
`.env.local` (`envDir`); nothing secret is copied here. Every check appends one JSON line to `spike/results.jsonl`
(never contains the debug token) and also shows on the page.

Use desktop Chrome (the one you will demo with), logged-in profile is fine. Server commands (the main session can start
them for you; run from the worktree with Node 26 on PATH):

- Dev (4.2, 4.3, 4.4): `npx vite --config spike/vite.config.ts` then open http://localhost:5173/
- Preview with enforced CSP (4.5): `npx vite build --config spike/vite.config.ts && npx vite preview --config spike/vite.config.ts`
  then open http://localhost:5173/ (same port: the API key referrer restriction allows only `http://localhost:5173`).
  Stop the dev server first; only one can use port 5173.

## Owner steps, in order

### Part 1: dev server, flag state 1 (4.2 A1, 4.3, 4.4 A4)
1. Open `chrome://flags/#prompt-api-multimodal-input`, set **Enabled**, relaunch Chrome. Also check
   `chrome://on-device-internals` shows the model as ready (if not, the first on-device call below downloads it; allow minutes).
2. Open http://localhost:5173/. **Click somewhere on the page first** (user activation is needed before a model download).
3. Click **Run all (online)**. Wait until the log stops changing (a first on-device call can take minutes if the model
   downloads; the buttons are disabled while a check runs). It runs A1 availability + image prompt, A2 (one and two
   images), A6 (four schemas), A4 (both cloud model ids), the D1 cloud call and a CSP report (no CSP on dev, so zero is expected).
4. If any check failed with a download or "user activation" error, click once on the page and run that button again.
5. A3: open `chrome://on-device-internals`, copy the model info (Model Status tab: name, version, size), paste it in the
   A3 textbox, click **A3 save note**.

### Part 2: A1 with the flag off
6. Set `chrome://flags/#prompt-api-multimodal-input` to **Disabled**, relaunch, reopen http://localhost:5173/, click once.
7. Click **A1 availability (image / text)** and **A1 ONLY_ON_DEVICE image prompt** (the prompt is expected to fail; that is the data).
8. Set the flag back to **Enabled** and relaunch before continuing.

### Part 3: O1 offline (4.4)
9. With the flag Enabled and the page loaded (click once on it), **turn off Wi-Fi / unplug Ethernet** (the real test).
   Confirm "navigator.onLine now" on the page shows `false`. Choose **wifi-off (real)** in the dropdown.
10. Click **O1 offline on-device image prompt**. Turn the network back on afterwards.
    Fallback only if you cannot disable the network: DevTools, Network tab, **Offline**, choose **devtools-offline (fallback)**
    in the dropdown, run again. DevTools Offline does not block everything a real outage does, so a pass there is weaker evidence.

### Part 4: CSP preview (4.5 D1)
11. Tell the main session, or: stop the dev server, run the preview command above, open http://localhost:5173/, click once.
12. Click **A1 ONLY_ON_DEVICE image prompt**, **D1 one cloud call**, then **D1 report CSP violations so far**.
    Optionally also open DevTools Console and note any red CSP errors.

Then tell the main session you are done; it reads `spike/results.jsonl` and records the answers.

## Limits to know
- The reCAPTCHA Enterprise key excludes `localhost`, and SPEC-FB-04 enables the App Check debug provider only when
  `import.meta.env.DEV`. A normal production build has `DEV=false`, so the preview build here forces `import.meta.env.DEV=true`
  (spike config `define`, build only; product code is unchanged). The debug token is therefore inlined into the ignored
  `spike/dist`. That makes the cloud call under CSP meaningful (it exercises `content-firebaseappcheck.googleapis.com`),
  but it is not the production reCAPTCHA path; reCAPTCHA origins are only proven on Hosting (15.3).
- The CSP is exactly SPEC-SEC-08. The Vite page needs no inline script, so none is allowed.
- 401/403 on a cloud call means the debug token is not registered or App Check enforcement does not accept it.
