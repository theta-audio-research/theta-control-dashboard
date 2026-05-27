# CREOSOTE Deep QA Ticket Pack

Generated: 2026-05-27T00:14:24.614389+00:00

## Strategy

Keep smoke tickets as ship gates; use Deep QA tickets for sonic identity, module behavior, regression, and next-build evidence.

## Categories

### INSTALL / HOST

- [open] `creosote-host-visibility` normal Smoke / Ship Gate
  - Question: Does CREOSOTE appear in the expected host/plugin browser under THETA Audio Research?
- [open] `creosote-instantiate` normal Smoke / Ship Gate
  - Question: Does CREOSOTE instantiate without crash or stuck scan?
- [open] `creosote-format-check` normal Smoke / Ship Gate
  - Question: Do the in-scope formats load as expected: VST3 / AU?
- [open] `creosote-install-replace` normal Smoke / Ship Gate
  - Question: Does the install/build command replace the previous build cleanly?

### BASIC AUDIO / STABILITY

- [open] `creosote-basic-audio` normal Smoke / Ship Gate
  - Question: Does audio pass/process correctly with no unexpected silence, crackle, hum, or level jump?

### SONIC CHARACTER

- [open] `creosote-sonic-core-identity` P0 Deep QA
  - Question: Does CREOSOTE still sound like a high-end analog character processor, not a generic saturation/EQ/compressor stack?
  - Acceptance: Pass only if the plugin has a clear sonic identity at subtle, medium, and pushed settings.
  - Test material: drums, bass, vocal, synth/drone, full mix
- [open] `creosote-sonic-level-matched-bypass` P0 Deep QA
  - Question: On level-matched bypass, does CREOSOTE improve weight, depth, motion, glue, or tone without merely getting louder?
  - Acceptance: Pass only if the improvement remains clear after output level is matched to bypass.
  - Test material: drums, bass, vocal, full mix
- [open] `creosote-sonic-real-material` P0 Deep QA
  - Question: Which real sources benefit from CREOSOTE, and which expose problems?
  - Acceptance: Notes must mention at least three source types and identify best/worst use cases.
  - Test material: drums, bass, vocal, synth/drone, full mix
- [open] `creosote-sonic-low-mid-weight` P1 Deep QA
  - Question: Does CREOSOTE add useful low-mid density and body without muddying 150–500 Hz?
  - Acceptance: Pass only if added weight does not blur bass/kick/vocal fundamentals.
  - Test material: bass, drums, full mix
- [open] `creosote-sonic-top-end-behavior` P1 Deep QA
  - Question: Does the top end stay expensive and controlled, or does it become fizzy, dull, harsh, or phasey?
  - Acceptance: Notes should identify whether the top end feels polished, dark, brittle, smeared, or unstable.
  - Test material: vocal, cymbals, full mix
- [open] `creosote-sonic-drive-scaling` P1 Deep QA
  - Question: As input, drive, or intensity increases, does CREOSOTE progress musically from subtle to rich to aggressive?
  - Acceptance: Fail if the usable range is tiny, jumpy, or only works at one setting.
  - Test material: drums, bass, full mix

### MODULE BEHAVIOR

- [open] `creosote-grit-tape-character` P0 Deep QA
  - Question: Does GRIT deliver believable tape/hysteresis movement across subtle, medium, and pushed settings?
  - Acceptance: Pass only if GRIT has a distinct use case from AMBER and CHARACTER.
  - Test material: drums, bass, full mix
- [open] `creosote-amber-era-voices` P0 Deep QA
  - Question: Do AMBER era/tube voices feel meaningfully different, useful, and not just EQ variations?
  - Acceptance: Notes must describe the audible difference between voices.
  - Test material: vocal, bass, synth, full mix
- [open] `creosote-amber-condition-age` P1 Deep QA
  - Question: Do tube condition/age controls add character without collapsing into noise, dullness, or gimmick?
  - Acceptance: Pass only if aging/condition settings remain musically usable over a reasonable range.
  - Test material: vocal, synth, full mix
- [open] `creosote-compress-mode-identity` P0 Deep QA
  - Question: Do the COMPRESS modes each have a clear musical use case with no obvious pumping, clicking, or level instability?
  - Acceptance: Notes must identify which mode is most useful and which needs work.
  - Test material: drums, bass, full mix
- [open] `creosote-summing-width-crosstalk` P1 Deep QA
  - Question: Do SUMMING width, crosstalk, balance, pregain, and headroom feel coherent and mix-safe?
  - Acceptance: Fail if stereo image collapses, phase gets weird, or balance shifts unexpectedly.
  - Test material: stereo drums, stereo synth, full mix
- [open] `creosote-character-master-macro` P1 Deep QA
  - Question: Does CHARACTER feel like a useful master identity control rather than a duplicate of GRIT/AMBER?
  - Acceptance: Pass only if CHARACTER changes the plugin identity in an intentional and controllable way.
  - Test material: drums, vocal, full mix
- [open] `creosote-outclip-limiter-interaction` P0 Deep QA
  - Question: Do OUT CLIP and LIMITER work together musically, catching peaks without dulling transient life?
  - Acceptance: Fail if clipping/limiting causes brittle distortion, pumping, or unexpected level jumps.
  - Test material: drums, full mix

### EQ / OUTPUT SURGERY

- [open] `creosote-eq-master-off` normal Smoke / Ship Gate
  - Question: Does EQ master OFF fully gate EQ processing while dimming the static curve as intended?
- [open] `creosote-eq-master-gate-regression` P0 Deep QA
  - Question: With bands enabled, does EQ master OFF fully bypass EQ processing?
  - Acceptance: Pass only if all audible EQ processing stops when EQ master is OFF.
  - Test material: pink noise, full mix, vocal
- [open] `creosote-eq-static-vs-live-curve-trust` P1 Deep QA
  - Question: Does the static/live EQ graph match what you hear, especially with dynamic bands active?
  - Acceptance: Fail if graph movement implies processing that is not audible, or misses processing that is audible.
  - Test material: pink noise, vocal, drums
- [open] `creosote-eq-dyn-up-down` P1 Deep QA
  - Question: Does positive DYN create useful upward movement and negative DYN create useful suppression?
  - Acceptance: Pass only if up/down dynamic behavior is obvious enough to trust.
  - Test material: vocal, drums, bass
- [open] `creosote-eq-hp-lp-authority` P1 Deep QA
  - Question: Do HP and LP filters audibly remove low/high content enough to trust the graph?
  - Acceptance: Fail if filters are visually active but sonically too weak or inconsistent.
  - Test material: full mix, pink noise

### INTERFACE / UX

- [open] `creosote-eq-summing-alignment` high Smoke / Ship Gate
  - Question: Do the EQ and SUMMING pages visually align after the v18.8.6 pass?
- [open] `creosote-version-visible` normal Smoke / Ship Gate
  - Question: Does the UI/build display the expected current version or build identity?
- [open] `creosote-interface-first-read` P1 Deep QA
  - Question: Can a user understand the signal flow and major sections within 30 seconds?
  - Acceptance: Pass only if signal flow, sections, and active states are visually obvious.
  - Test material: UI inspection
- [open] `creosote-interface-control-hitboxes` P1 Deep QA
  - Question: Are knobs, tabs, buttons, and graph nodes easy to click without accidental adjacent actions?
  - Acceptance: Fail if any frequent control feels fiddly or error-prone.
  - Test material: UI inspection
- [open] `creosote-interface-on-off-feedback` P1 Deep QA
  - Question: Do ON/OFF states, dimming, fills, meters, and active indicators make the processing state obvious?
  - Acceptance: Pass only if bypassed/inactive modules are visually unambiguous.
  - Test material: UI inspection
- [open] `creosote-interface-no-legacy-erosion-leaks` P1 Deep QA
  - Question: Are there no visible EROSION-era labels, filenames, or identity leaks in user-facing UI?
  - Acceptance: Fail if legacy product identity appears anywhere a tester/user can see it.
  - Test material: UI and installed artifact inspection

### PRESETS / STATE / AUTOMATION

- [open] `creosote-preset-state` normal Smoke / Ship Gate
  - Question: Do presets/session reload preserve the current state correctly?
- [open] `creosote-presets-factory-identity` P1 Deep QA
  - Question: Do factory presets show distinct useful CREOSOTE identities instead of minor variations?
  - Acceptance: Notes must identify at least three useful presets and any weak/redundant presets.
  - Test material: factory presets
- [open] `creosote-presets-load-without-jumps` P0 Deep QA
  - Question: Do presets load without level jumps, clicks, stuck meters, or wrong ON/OFF states?
  - Acceptance: Fail if preset switching causes unsafe jumps or stale UI/audio state.
  - Test material: factory presets, user presets
- [open] `creosote-session-recall` P0 Deep QA
  - Question: After saving/reopening a DAW session, are all key module states, EQ bands, and UI tabs restored?
  - Acceptance: Pass only if session recall restores both audio state and visible UI state.
  - Test material: Ableton/Logic session reload
- [open] `creosote-automation-clicks` P1 Deep QA
  - Question: Does automation of drive, mix, EQ, bypass, and module toggles avoid clicks or zippering?
  - Acceptance: Fail if common automation produces obvious zipper noise or clicks.
  - Test material: DAW automation lanes
- [open] `creosote-offline-render-match` P1 Deep QA
  - Question: Does offline bounce match realtime playback closely enough to trust?
  - Acceptance: Pass if offline render has no obvious missing processing, timing mismatch, or instability.
  - Test material: realtime playback vs offline bounce

### PERFORMANCE / REGRESSION

- [open] `creosote-cpu-default-vs-heavy` P1 Deep QA
  - Question: What is CPU at default, heavy saturation, dynamic EQ active, and limiter active?
  - Acceptance: Notes must include rough CPU behavior across light and heavy states.
  - Test material: host CPU meter
- [open] `creosote-denormal-silence` P1 Deep QA
  - Question: After silence or near-silence, does CPU spike or audio misbehave?
  - Acceptance: Fail if silence produces CPU spikes, stuck denormals, or unstable output.
  - Test material: silence, fade-outs, sparse material
- [open] `creosote-meter-graph-repaint-load` P2 Deep QA
  - Question: Do meters and EQ graph redraw smoothly without making the UI sluggish?
  - Acceptance: Fail if visual repaint noticeably harms interaction or host performance.
  - Test material: UI inspection during playback
- [open] `creosote-extreme-settings-survival` P0 Deep QA
  - Question: At extreme settings, does CREOSOTE avoid NaN, runaway feedback, huge level jumps, or host instability?
  - Acceptance: Fail immediately if any setting can create unsafe output or host instability.
  - Test material: extreme parameter sweep

### ROADMAP / EVIDENCE

- [open] `creosote-character-v3-reference-status` P2 Deep QA
  - Question: Have the hardware/reference recordings happened, and are they ready to feed CHARACTER v3 work?
  - Acceptance: Notes should say what references exist, what is missing, and what should be captured next.
  - Test material: reference recordings / notes
- [open] `creosote-limiter-extraction-feedback` P2 Deep QA
  - Question: What CREOSOTE limiter behavior should be carried into the planned THETA Limiter standalone product?
  - Acceptance: Notes should identify useful limiter traits and any behavior to avoid.
  - Test material: limiter/out clip tests
- [open] `creosote-next-build-decision` P0 Deep QA
  - Question: Based on testing, should the next build be v18.8.6 polish, v18.9.0 feature work, or CHARACTER v3?
  - Acceptance: Pass only when the next build direction is clear from test evidence.
  - Test material: completed ticket notes

