status: open

# Split try-mode.ts

**Problem:** `src/lib/try-mode.ts` (974 lines) is the largest justified allowlist entry with a plausible seam; it held its size in Phase 2 only for time-risk reasons.

**Location:** `src/lib/try-mode.ts` (allowlisted in `scripts/check-file-limits.mjs`).

**Suggested fix:** A `try-mode/` package behind a stable barrel, on the classroom.ts pattern: the state machine (`transitionTryMode` + lock asserts), geometric objectives (gap/span/arch computations, `archCurvePoints`), and serialization (`serializeTrySession`, snapshots/groups). Remove the allowlist entry in the same PR; per ADR 003, removing entries needs no ADR — only adding does.
