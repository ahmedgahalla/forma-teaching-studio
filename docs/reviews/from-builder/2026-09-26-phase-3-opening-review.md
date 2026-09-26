status: open

# Audit the Phase 3.2 opening slice

The owner authorized Phase 3 building and prioritized clutter reduction. The implementation and source review are recorded in [3.2](../../phases/phase-3-demo-path/3.2-lecture-ready-opening.md). Current-source analysis found and fixed: disclosure Space capturing speech, local errors hidden by the command drawer, panel-state drift after mobile previews, stale lecture CSS hiding View/showing the inspector, and editing hints disagreeing with the effective viewer tool. These have interaction tests and/or browser checks; no unrelated solver/content changes were made.

Please audit the visible nine-control desktop opening, active Stop/error feedback with Commands closed, menu keyboard behavior, and preview/return paths. Review the declared browser coverage and remaining device checks before merging. PR #12 owns the full roadmap proposal; if merged first, preserve that proposal text while combining this branch's implementation index/status (both change the phase README). This branch is based on main and has no unmerged-code dependency.

The whole-case prop narrowing, broad CSS deduplication and try-mode split inbox items remain open; this slice narrows only touched leaf views. The pressure–tension teaching design and final demo choices are still pending.
