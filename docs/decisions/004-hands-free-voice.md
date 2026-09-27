# ADR 004 — Hands-free lecture voice

**Date:** 2026-09-26 · **Status:** accepted by owner decision; implementation awaiting audit

## Context and decision

Forma is a professor-controlled university lecture assistant. A standing professor may be away from the laptop and use a projector and presenter clicker. Holding Space for every request does not support that setting. The owner explicitly authorized a session-based hands-free mode on 26 September 2026, superseding the earlier “There is no always-listening mode” statement in `VOICE_CLASSROOM.md`.

Retain hold-to-talk as the default. Add explicit hands-free activation via a visible microphone toggle or M/B/period. Persist the voice preference, English recognition language and optional spoken replies, but never persist an active microphone or start recognition on page load. Both modes use browser speech recognition and the same validated teaching runtime as typed commands. No new TeachingActions or server endpoints are introduced.

## Privacy and mitigations

While hands-free recognition is running, the browser vendor's speech service receives audio, including speech that Forma later ignores. The wake phrase is a local gate on recognized final text; it does not prevent that audio transmission. This is not an offline wake-word detector or OpenAI audio transcription.

- Require explicit opt-in each page session. Disclose audio processing on the toggle and in Settings and the professor guide.
- Keep a red Listening indicator visible while enabled, including a paused label during narration. The toggle uses `aria-pressed`.
- Full wake phrases are **Forma** and **for ma**, optionally prefixed by **hey**, **ok** or **okay**. A bare full wake phrase arms one six-second follow-up. Only full wake phrases and their armed follow-ups can show interim captions or use optional AI/Analyze.
- Mishearings **former**, **forma's** and **fauna** are local-only aliases. A final alias command must be accepted by the local parser before submission; rejected aliases produce no caption, HUD error, AI/Analyze request or history. A bare alias never arms the follow-up window, and alias interim text is never displayed.
- Discard non-wake final speech without submitting it, storing it, logging it or sending it to AI. The recognition service itself has already received the audio. Only accepted requests enter existing command processing and request history.
- Pause recognition while Forma speaks, during hold-to-talk capture, and whenever the tab becomes hidden. Abort the current microphone session and clear the armed follow-up on pause/stop. Resume an already enabled session only when the tab is visible and other pause reasons have ended. The HUD shows **Hands-free paused** for general pauses and **Listening · paused while Forma speaks** during narration, including on return if another pause reason remains.
- Turn off on explicit toggle/“Forma, stop listening”, pagehide/navigation/unmount, a voice mode/language change, permission/service denial, unavailable microphone, initialization/start failure, or three network failures without a successful final result. Never restart a deliberately stopped session. Window blur alone keeps hands-free active and discards only unfinished hold-to-talk capture.
- Restart normal silence/aborted sessions at 250 ms. Sessions lasting at least 2.5 seconds reset restart attempts on both error and end paths; only immediate failures accumulate the bounded 250 ms–4 s backoff. Permission and microphone failures require a new explicit activation after correction.

## Navigation and execution

Presenter next/previous keys submit the same local grammar as speech: workflow mode selects its authored workflow step; case mode with an active short lesson selects the lesson step; otherwise select the prepared-case/demonstration stage. Workflow mode takes priority because its context also reports an active lesson. Existing validation, scene revisions, whole-request Undo and optional AI behavior remain authoritative. Explicit AI/Analyze preferences retain their existing meaning.

## Consequences and limits

Wake aliases retain recognition tolerance only for locally understood commands. Ordinary speech such as “Former guidelines treated this differently” is silently ignored; “former, show the roots” can execute locally. Full Forma/for ma requests retain optional AI/Analyze behavior. Spoken confirmations are optional and off by default. Confirmation summaries are limited to twelve words; clarification text is retained in full.

There is an unavoidable conflict between pausing recognition during speech output and detecting a new spoken Stop during that pause. This implementation prioritizes the requested feedback prevention. Bare Stop/Cancel is accepted without a wake phrase during playback when recognition is running; during narration use Stop, Escape, or the hold-to-talk button (which interrupts narration before capture). The paused indicator makes this state visible. Always hearing Stop during narration would require a separate audio/echo-cancellation design, outside this browser-recognition slice.

Real microphone, browser/device, projector readability and DPR 1/2 acceptance checks remain auditor/manual work. Automated fakes do not establish browser vendor behavior or clinical validation. Synthetic anatomy and illustrative movement remain educational only.
