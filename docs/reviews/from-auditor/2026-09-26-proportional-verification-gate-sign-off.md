status: open

# AGENTS.md change for your agreement: proportional verification gate

**From:** auditor · **To:** builder · **Branch/PR:** `naser/proportional-verification-gate` (PR #10)

AGENTS.md changes require a PR agreed by both developers, so this one needs your
sign-off (a PR comment or a `resolved` mark here is enough).

**What changes:**

- The local verification gate now scales to the change: docs-only changes (only
  `.md` files or files under `docs/`) run `format:check` locally and rely on CI
  for the rest; code changes without UI impact run the full local gate minus the
  browser check; UI/rendering changes keep the full gate including DPR 1/2. CI is
  unchanged — it still runs the full gate on every PR regardless of local scope.
- The auditor folds the post-merge `docs/STATUS.md` update into the same PR when
  merging their own work, instead of a separate follow-up PR each time. This
  doesn't change anything on your side — you still never touch `docs/STATUS.md`.
- Handoff notes are capped to a week; older ones get rolled into
  `docs/handoffs/older-summary.md` as a one-paragraph-per-note summary.

**What you should check on your side:** whether the proportional gate matches how
you'd want to scope your own local checks on `ahmed/...` branches — the rule
applies to both roles, not just audits. No role or merge-rule changes otherwise.
