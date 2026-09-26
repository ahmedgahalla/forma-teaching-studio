# Phase 4 — Voice-led lecture assistant

**Goal:** let a university dental/orthodontic professor drive Forma while standing away from the laptop, with clear student-facing feedback and existing validated teaching controls.

**Status:** 4.1 implemented for audit; 4.2 separately owned in parallel; 4.3 planned.

| Sub-phase                                          | Ownership and scope                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [4.1 — Voice-led control](4.1-hands-free-voice.md) | This builder slice: hands-free capture, wake gate, projector captions, presenter navigation, local grammar and optional spoken replies.       |
| 4.2 — Tooth study and explanations                 | Parallel builder/worktree owns new tooth-study TeachingActions and explanatory presentation. Not implemented or documented as shipped by 4.1. |
| 4.3 — Visual clarity                               | Planned; projector/device rehearsal and further anatomy/presentation clarity.                                                                 |

**4.1 branch:** `ahmed/phase-4-voice-lecture-assistant`, based on `ahmed/phase-3-lecture-opening` at `ed2164e`. **Dependency:** draft PR [#13](https://github.com/ahmedgahalla/forma-teaching-studio/pull/13). No 4.1 PR created by this session; the orchestrator reviews and commits.

See [ADR 004](../../decisions/004-hands-free-voice.md) for the owner's hands-free decision, privacy implications, auto-off rules and narration interruption limit. The product remains a synthetic education prototype without clinical validation.
