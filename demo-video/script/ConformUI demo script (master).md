# ConformUI demo script

Length: 3:00 max. Target: 2:50.
Rule: the video must make sense with the sound off. So every beat has a caption on screen. The voice adds detail. It never carries the only copy of a point.

---

## 1. Before recording

1. Main Chrome profile (Gemma 4 on-device ready):
   * Open https://conformui.web.app.
   * Settings > Clear all data. Onboarding shows.
   * Header pill reads "On-device ready".
   * Privacy counter reads "Nothing has left this device".
2. Second tab: `sample-site/flawed/index.html` from the repo, at 1440 px wide, DevTools open on Console.
3. A code editor window with the flawed page's source. Show it generically: no product name or logo on screen.
4. Second Chrome profile (no on-device model): data cleared, DevTools device emulation at 390 px wide.
5. DevTools Network tab ready, so "Offline" is 1 click away.
6. Screen at 1920×1080. Browser zoom 110-125%, so labels are readable on a phone.
7. Record 1 fallback take of each beat on a day when the model is ready.

## 2. Recording rules (for muted viewers)

1. Captions are burned into the video, bottom centre, white text on a dark bar, max 2 lines, about 8 words per line.
2. Each caption stays on screen for at least 2 seconds per line.
3. When a number or label matters, zoom in on it (1.5-2×) or draw a box around it. Hold for 2 seconds.
4. Show the click: cursor highlight on, and pause 0.5 s on each button before clicking.
5. No background music. Or very quiet, if any.
6. After upload, paste the voice-over text below into YouTube as a transcript. YouTube syncs it into subtitles.

---

## 3. Script

Format per beat: **Do** (what happens on screen), **Caption** (burned-in text), **Voice** (what you say).

### Beat 1: Problem (0:00–0:15)

**Do:**
1. Split screen: the design on the left, the built page (`flawed`) on the right.
2. Slow zoom on the CTA button in both.

**Caption:**
> An agent built this page from a design.
> Does it match? How would you prove it?

**Voice:**
> A coding agent built this page from a design. It looks right. But "looks right" is not a requirement. And "fix what looks wrong" gives the agent nothing to act on.

### Beat 2: A private contract (0:15–0:45)

**Do:**
1. DevTools > Network > Offline. The header shows "Offline".
2. Projects > **Try the sample**.
3. Project > **Extract contract**.
4. Zoom on the Engine badge: **On-device**.
5. Zoom on the AI-vs-verified panel ("AI proposed [N] requirements; [M] match the verified contract"; fill in from the 14.4 live run).
6. Point at 1 mobile item labelled **Inferred**.
7. Zoom on the counter: "Nothing has left this device".

**Caption:**
> Offline. The design becomes a contract of checkable requirements.
> Read by Gemma 4, on this device.
> Nothing has left this device.

**Voice:**
> ConformUI turns the design into a contract: a list of requirements you can check. Gemma 4 reads the design on this device. The network is off, so nothing leaves. Mobile expectations are inferred, so they are labelled advisory.

### Beat 3: Measured, not guessed (0:45–1:20)

**Do:**
1. Second tab (flawed page). Paste the snippet into the Console, press Enter. Zoom on "ConformUI snapshot copied". Keep this to 5 seconds.
2. Back in ConformUI: **Paste snapshot**, then **Run**.
3. Zoom on each Finding for about 3 seconds:
   * CTA width: "132 px vs 220 px (−40%), from DOM snapshot".
   * Missing hero illustration.
   * Heading hierarchy.
   * Mobile overflow: Inferred, Minor.
   * CTA colour: Needs review.
4. Open the Engine trace. Zoom on "On-device" / "Measured" and 0 bytes sent.

**Caption:**
> Every number is measured, not guessed by a model.
> CTA: 132 px wide. The design says 220 px.
> The engine trace shows what ran where.

**Voice:**
> Every number comes from a deterministic engine, not a model. The CTA is 132 pixels wide. The design says 220. The engine trace shows what ran where. And still, nothing has left the device.

### Beat 4: Cloud, only when I ask (1:20–1:45)

**Do:**
1. Network back on. The "Offline" pill goes away.
2. **Deep Analysis**. The sheet "Send this run for Deep Analysis?" opens.
3. Zoom on the list of images and the byte size. Hold 2 seconds.
4. **Send to cloud**.
5. Zoom on the CTA colour Finding: "Refined by Cloud".
6. Engine trace now has a Cloud step. The privacy counter changes.

**Caption:**
> Harder judgement: I choose the cloud.
> I see exactly what is sent, and its size.
> The result is labelled Cloud.

**Voice:**
> Some judgements are harder. For those, I choose the cloud. Before anything leaves, I see exactly what is sent and how big it is. The result is labelled Cloud, so it never pretends to be measured.

### Beat 5: Hand the fix to the agent (1:45–2:10)

**Do:**
1. **Copy fix prompt**. Toast: "Fix prompt copied".
2. Code editor window: paste the prompt. Cut the agent's work.
3. Back in ConformUI: **Re-verify**. Sheet "Re-verify against Contract v1".
4. **Load fixed implementation**, then **Run Re-verify**.

**Caption:**
> The fix prompt: measured, verifiable instructions.
> The agent fixes the page.

**Voice:**
> The fix prompt gives the agent measured instructions it can verify. Not "make it look better". "Make the button 220 pixels wide."

### Beat 6: Prove what landed (2:10–2:35)

**Do:**
1. Zoom on the summary: "6 resolved, 1 remaining".
2. Open the remaining Finding: hero-to-features spacing (design: 96 px).
3. **Diff overlay** on the evidence image. Hold 3 seconds.

**Caption:**
> Re-verify: 6 resolved, 1 remaining.
> The remaining one comes with evidence.

**Voice:**
> Re-verify checks the same contract again. 6 issues are resolved. 1 spacing issue remains, and it comes with evidence. So the agent's "done" is now a measured "done".

### Beat 7: Export and every device (2:35–2:50)

**Do:**
1. "More run actions" menu (⋯) > **Export report** > Markdown. Show the downloaded file for 1 second.
2. Switch to the second profile (390 px, no on-device model).
3. **Try the sample** > **Extract contract**.
4. Sheet "Allow cloud for this project?" > **Allow for this project**.
5. Zoom on the Engine badge: **Cloud**.

**Caption:**
> Reports export as Markdown or JSON.
> No on-device model? The cloud runs it, after consent.

**Voice:**
> Reports export as Markdown or JSON. Where on-device AI is not available, the first pass runs in the cloud, only after consent, and the badge says so.

### Beat 8: Close (2:50–3:00)

**Do:**
1. ConformUI logo.
2. Under it: https://conformui.web.app and the repo URL.

**Caption:**
> Design intent as a contract.
> Measured, not guessed. Private by default.

**Voice:**
> Design intent as a contract. Measured, not guessed. Private by default.

---

## 4. Fallbacks

1. On-device not ready on recording day: use the fallback take of Beats 2–3. Never fake the On-device badge.
2. Cloud call fails: retry once. Still failing: use the fallback take of Beat 4.
3. The CTA colour (R-07) verdict differs live: use the fallback takes of Beats 3–4 and 6.
4. Over 3:00: cut the paste into the editor in Beat 5 first. Then drop the export in Beat 7.

## 5. Timing check

* Voice-over total: about 230 words. At a calm 120-130 words per minute, that is about 1:50-2:00 of speech. The rest is pauses and zooms.
* Read it aloud once with a timer before recording. If a beat runs long, cut words, not pauses. Muted viewers need the pauses to read.
