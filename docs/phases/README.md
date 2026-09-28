# Phases

Numbered work phases, in execution order. Every feature — including builder work — gets a numbered phase or sub-phase doc here, updated in the same PR as the work (AGENTS.md § documentation rules).

| Phase                                        | Status                   | Summary                                                                                             |
| -------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| [1 — tooling](phase-1-tooling/README.md)     | merged (`v0.13-phase1`)  | Shared rulebook, Prettier/ESLint, line endings, CI, docs system, stale-audit fix                    |
| [2 — refactor](phase-2-refactor/README.md)   | merged (`v0.14-phase2`)  | Dead code removal; split Studio.tsx, globals.css, oversized files, backend routers; feature folders |
| [3 — demo path](phase-3-demo-path/README.md) | draft PR stack; unmerged | Sample lecture, focused model, audience window and researched mechanics; browser acceptance pending |

Historical pre-phase work is recorded in `docs/VERIFICATION.md` (v0.2 → v0.12) and `docs/UPGRADE_PLAN.md`.

Phase [4 — voice-led lecture assistant](phase-4-voice-lecture-assistant/README.md) begins with 4.1 hands-free control on top of the Phase 3.2 PR #13 dependency. Tooth study (4.2) is separately owned in parallel; visual clarity (4.3) is planned.

The later Phase 3 follow-up [3.15 — Lecture presentation and mechanics](phase-3-demo-path/3.15-lecture-mechanics.md) builds on the ready-made lecture in PR #14 with selected-tooth focus, comparison, audience projection, tissue explanations and eight mechanics categories. Implementation and verification are recorded per branch; this index does not claim the dependency stack has merged.

[3.16 — Mechanics-aware scene explanations](phase-3-demo-path/3.16-analysis-mechanics.md) follows PR #15 and supplies the configured support/load inputs to Analyze, preserving privacy and current/revealed result gating.

[3.17 — Cancel obsolete AI requests](phase-3-demo-path/3.17-ai-cancellation.md) follows PR #16 with asynchronous provider cleanup, disconnect handling and shared total deadlines, including the phone bridge.

[3.18 — Consistent lecture entry and view controls](phase-3-demo-path/3.18-lecture-controls.md) follows PR #17 with matching sample-entry commands and compact camera, roots and Fit controls in the lecture heading.
