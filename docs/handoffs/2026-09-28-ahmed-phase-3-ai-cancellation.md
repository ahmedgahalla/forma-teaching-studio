# Handoff — cancellable AI requests

**Branch:** `ahmed/phase-3-ai-cancellation` · **Base:** PR #16 at `a70eccd` · **Phase:** [3.17](../phases/phase-3-demo-path/3.17-ai-cancellation.md) · **PR:** pending

Interpretation and Analyze now use async provider calls under a shared request-lifetime/deadline wrapper. It observes disconnect after body consumption, cancels and awaits upstream work, preserves caller cancellation and returns fixed safe errors. One validation repair remains bounded by the original interpretation deadline. The authenticated phone bridge uses the same wrapper, releasing its concurrency slot after cancelled client cleanup.

The full local gate passed: 2,551 frontend tests across 111 files, 619 backend tests, typecheck, zero-warning lint, format, file limits (421 files), production build and offline demo asset check. Frontend workers remained isolated, with the same CLI-only single-thread-worker selection used in Phase 3.16. No tests removed. The implementation uses the installed SDK without dependency changes or real provider calls. No local backend listener was running when this work began; running deployments need a restart from the matching revision. The existing static preview remains available. Browser access is still restricted; no actual UI, microphone, projector or external gateway verification is claimed.

The analysis/context review is ready for auditor assessment after verification. The unmerged PR stack still needs CI on main-targeted PRs and Claude's audit/merge process. Ready-made lecture, no lecture creation, teacher-first controls and the distinction between illustrative mechanics and patient prediction remain the product direction. STATUS and AGENTS are untouched.

The broader goal remains active pending review and device acceptance. Phase 4 has no PR yet; its existing auditor report directs opening that PR after dependency #13 merges. Preserve that order when merging the later stack. No review or merge has been performed by the builder.
