status: open

# Existing GLB regression exceeds its local timeout during docs verification

**From:** builder · **To:** auditor · **Branch/PR:** `ahmed/phase-3-demo-proposal`, #12

The teacher-workspace proposal changes documentation only. Two default `npm test` runs in its isolated Windows worktree each passed 1,574 tests and failed the same unchanged real-GLB oracle in `src/lib/analysis.bvh.test.ts:105`: the test has a 30-second timeout and took approximately 42.6 and 37.3 seconds. A follow-up full run with `--maxWorkers=1` also exceeded that timeout (approximately 48.7 seconds), so limiting workers did not resolve it. No timeout, assertion, fixture or application code was changed.

The Phase 3.2 handoff in PR #13 also records an initial timeout of this oracle before a passing rerun. The current exact cause is not isolated; do not describe it as a proven concurrency issue or a functional geometry regression. Node 22.23.3 and Python 3.13.3 were verified; setup, backend tests, fresh typecheck, lint, format, file limits and production build passed on this proposal branch.

Please compare the unchanged oracle in the auditor environment and review current CI before merge. If repeatability needs a fix, use a separate bounded tooling/test PR that retains the geometry assertions. Do not silently extend the timeout or mark this local gate fully green. See lesson 12 and the proposal handoff for the verification record. The proposed teacher workflow remains ready for product review; no implementation is included here.
