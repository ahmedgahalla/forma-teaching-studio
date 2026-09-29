# UI and AI reliability handoff

Branch: `ahmed/phase-3-ui-ai-reliability`; base PR #27 at `9763e73`.

Implemented clearer lecture step/navigation and teaching-aid hierarchy, Atlas control refinements, explicit same-app AI reconnect, advanced backend configuration and shared safe cancellable request handling. Backend provider failures now distinguish configuration, permission, connection and quota cases. No solver, clinical content or model assets changed.

The active demo worktree has no private AI configuration. The original project has OpenRouter configured. The owner has been asked to choose reconnecting it or direct OpenAI; no key values were printed or copied and no live provider call was made. Resume configuration only after this choice.

The automated gate passes: **3,045 frontend tests in 169 files**, **659 backend tests**, TypeScript, ESLint with zero warnings, Prettier, file limits (555 files), production static build and offline demo-asset checks. Frontend coverage increased by 54 tests and backend coverage by 20; no tests were removed. The first full frontend run caught an old assertion that disabling AI left Analyze active. The updated tests verify automatic return to local commands and retain a separate disabled-analysis guard; the final full run passes. Browser inspection is prohibited by the previous automatic security review, including workarounds. Keep PR draft; real-browser/DPR/projector acceptance and live provider verification remain outstanding.

See [phase 3.28](../phases/phase-3-demo-path/3.28-ui-ai-reliability.md) and [auditor inbox](../reviews/from-builder/2026-09-29-ui-ai-reliability.md). Existing broader auditor cleanup items and professor review of the case remain open. AGENTS.md and auditor-owned STATUS.md are untouched.
