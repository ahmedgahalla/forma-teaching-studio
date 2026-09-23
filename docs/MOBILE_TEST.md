# Test Forma on your phone

The existing [private phone link](https://forma-teaching-mobile.ahmedgah123.chatgpt.site) works across networks and remains on **version 0.8**. Sign in with the same ChatGPT account if prompted. **The Midnight Lab redesign is not deployed there yet.**

## New local build: version 0.11

The packaged build and host computer at `http://127.0.0.1:3000` contain the professor console, question/reveal, group focus and isolation, improved anatomy rendering, Midnight Lab, the Clinical Studio theme, compact tool panels, persistent preview decisions, and the version 0.9 Blender anatomy / twelve-case library. A phone on another network cannot reach the host through that localhost URL; use the existing remote-control session to inspect the host browser, or wait for an updated private deployment.

The authenticated source-hosting push on 23 September 2026 timed out. No new saved version or deployment was submitted. The earlier owner-private publication was left intact. The earlier v0.10 static export was prepared in `../forma-mobile`, at local commit `0deb1c40f67d472fa8b12ab61cf35439dc114caa`, ready for a future publication retry. That checkout has not been updated to v0.11; an additional `forma-version.json` identifies version 0.10.0.

After publication, check:

1. Switch between **Midnight** and **Clinical** using the moon/sun button; reload to check the saved preference.
2. Open **Teaching library**, choose a case, play/pause, and explore its arrangement.
3. Type `select upper front six`, then `move the selected segment posteriorly 0.5 mm`.
4. Keep Tools closed and inspect the fixed preview decision bar. Try Modify, Discard and an eligible Apply.
5. Check portrait, landscape, short screens and the on-screen keyboard. Test roots, labels, overlay, orbit and lecture mode.

Read the [UI guide](UI_GUIDE.md) and [case command guide](CASE_WORKSPACE.md). Version 0.11 was checked in the connected browser at desktop, 800px and 390px widths. This is not a physical phone/touch or microphone test; those checks remain to be performed.

Core typed commands, synthetic models and prepared demonstrations need no API key. The optional Python/OpenAI backend is not deployed on the private static site. Save a case before reloading; unsaved session state is temporary.

## Existing published version 0.8

Sites reported this earlier deployment as succeeded. It remains the last confirmed publication; that does not establish a new phone/browser interaction test.

- Site: `appgprj_6ab39ed0b82881919f49cba3045245ce`
- Version: `appgprj_6ab39ed0b82881919f49cba3045245ce~appgver_44b65b789aec8191be46eac300f4407b`
- Deployment: `appgdep_6ab3a26b8b1c8191963f0fb78068b6af`
- Published source commit: `3369c0088dac5bc11e126e451f5390b2bceb0652`

Keep this Site identity and owner-only access when updating the hosted export.
