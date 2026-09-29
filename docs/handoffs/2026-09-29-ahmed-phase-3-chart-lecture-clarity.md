# Tooth chart and lecture clarity handoff

Branch: `ahmed/phase-3-chart-lecture-clarity`; base PR #28 at `417c3a2`. Draft PR pending.

Implemented separate model/chart space with a scrolling workspace, local hover/focus preview and stronger warm 3D/diagram highlights, and clearer lecture entry, review/present labels, visible step count and capability-based guidance. Question detours name the paused lecture/step and retain the existing Return action. Old and new typed/voice presentation labels share the validated runtime actions.

The final automated gate passes: **3,073 frontend tests in 171 files**, **659 backend tests**, TypeScript, ESLint with zero warnings, Prettier, file limits (558 files), production static build and offline demo-asset checks. There are 27 added frontend cases and no removed test cases; highlight assertions moved from tissue-material coverage to the dedicated glow owner tests. The first full run mixed old clarification code with an updated expectation during the final copy edit and failed four assertions. The fresh affected suite passed all 88 tests, and the complete rerun against frozen code then passed. Browser/GPU/DPR/projector acceptance remains blocked by the previous automatic security review; no workaround or rendered appearance claim is included. Keep the PR draft until auditor browser checks and CI pass.

The existing OpenRouter launcher continues to serve this worktree at http://127.0.0.1:3012/ with backend port 8002. A production rebuild updates the static output. No private provider configuration changed. Primary checkout work on `ahmed/professor-walkthrough-video` is preserved.

See [phase 3.29](../phases/phase-3-demo-path/3.29-chart-hover-lecture-clarity.md) and [auditor inbox](../reviews/from-builder/2026-09-29-chart-lecture-clarity.md). Lesson 42 recurrence and a proposed joint rule are documented; AGENTS.md and auditor-owned STATUS.md are untouched. Broader auditor cleanup and educator review remain open.
