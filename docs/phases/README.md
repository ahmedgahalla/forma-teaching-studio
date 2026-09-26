# Phases

Numbered work phases, in execution order. Every feature — including builder work — gets a numbered phase or sub-phase doc here, updated in the same PR as the work (AGENTS.md § documentation rules).

| Phase                                        | Status                    | Summary                                                                                             |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| [1 — tooling](phase-1-tooling/README.md)     | merged (`v0.13-phase1`)   | Shared rulebook, Prettier/ESLint, line endings, CI, docs system, stale-audit fix                    |
| [2 — refactor](phase-2-refactor/README.md)   | merged (`v0.14-phase2`)   | Dead code removal; split Studio.tsx, globals.css, oversized files, backend routers; feature folders |
| [3 — demo path](phase-3-demo-path/README.md) | started; 3.2 under review | Large full-bite opening view, advanced-tool drawer, scripted 3–4 min walkthrough                    |

Historical pre-phase work is recorded in `docs/VERIFICATION.md` (v0.2 → v0.12) and `docs/UPGRADE_PLAN.md`.

Phase [4 — voice-led lecture assistant](phase-4-voice-lecture-assistant/README.md) begins with 4.1 hands-free control on top of the Phase 3.2 PR #13 dependency. Tooth study (4.2) is separately owned in parallel; visual clarity (4.3) is planned.
