# Phase 4 — Voice-led lecture assistant

**Goal:** let a university dental/orthodontic professor drive Forma while standing away from the laptop, with clear student-facing feedback and existing validated teaching controls.

**Status:** 4.1–4.5 implemented and audited ([audit report](../../audits/2026-09-27-ahmed-phase-4-voice-lecture-assistant.md)). The host gate passed and browser checks with simulated speech passed at DPR 1 and 2; new baselines are in [`docs/baselines/2026-09-27-ahmed-phase-4-voice-lecture-assistant-e9215f6/`](../../baselines/2026-09-27-ahmed-phase-4-voice-lecture-assistant-e9215f6/). Real microphone/projector acceptance and educator content review remain outstanding.

| Sub-phase                                                | Ownership and scope                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [4.1 — Voice-led control](4.1-hands-free-voice.md)       | This builder slice: hands-free capture, wake gate, projector captions, presenter navigation, local grammar and optional spoken replies.                                              |
| [4.2 — Tooth study and explanations](4.2-tooth-study.md) | Implemented on the 4.1 branch: anatomy data, isolated labelled tooth views, explanations, local grammar, restoration and presenter navigation.                                       |
| [4.3 — Visual clarity](4.3-visual-clarity.md)            | Implemented: full canvas with overlaid captions and safe-area framing, smooth cameras, material contrast and live DPR updates; new baselines captured by the auditor.                |
| [4.4 — Explain by voice](4.4-explain-by-voice.md)        | Implemented: 40-term authored glossary, spoken/captioned definitions and side card, ten-step anatomy tour, speech-unavailable text fallback and Guide/Library examples.              |
| [4.5 — Audit fixes](4.5-audit-fixes.md)                  | All eleven findings: grammar precedence, voice lifecycle/aliases/visibility, study return state, sequential synthetic preflight, camera destinations/orbit and disclaimer clearance. |

**4.1 branch:** `ahmed/phase-4-voice-lecture-assistant`, based on `ahmed/phase-3-lecture-opening` at `ed2164e`. **Dependency:** draft PR [#13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13). No 4.1 PR created by this session; the orchestrator reviews and commits.

See [ADR 004](../../decisions/004-hands-free-voice.md) for the owner's hands-free decision, privacy implications, auto-off rules and narration interruption limit. The product remains a synthetic education prototype without clinical validation.
