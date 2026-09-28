# Handoff — Claude tooth diagram

**Branch:** `ahmed/phase-3-atlas-tooth-diagram` · **PR:** pending draft · **Base:** PR #22 at `0c8e9b2` · **Phase:** [3.23](../phases/phase-3-demo-path/3.23-atlas-tooth-diagram.md).

The bottom Explore chart now uses Claude's original crown/root SVG formulas and bundled tooth dimensions, with proportional widths, quadrant dividers, R/L markers and vertically reflected lower teeth. Existing selection behavior remains. Missing teeth leave blank slots; default cases remain 28 teeth, with wisdom positions available only when the current case contains them. There is no new model import, lecture behavior change or producer-workspace edit.

Final automated gate passes: 2,861 frontend tests in 151 files, 639 backend tests, typecheck, zero-warning lint, formatting, file limits (518 files), production build and exported-demo asset check. Node 22.23.3 / Python 3.13.3. No tests were removed. Main was fetched/merged and pulled at session start, then fetched/merged again before opening the PR; no new main changes were required. Dependencies match the previously verified locks. The existing port 3012 preview serves the rebuilt export. The obsolete mobile padding override was removed following independent source review and recorded in the learning loop. AGENTS and auditor-owned STATUS remain untouched.

Next: auditor review and actual visual acceptance, including source comparison, short-screen layout, DPR 1/2, selection states and prepared-case/braces/typed-command journeys. The earlier security rejection remains binding; no browser/HTTP workaround is allowed. Keep this stacked PR draft; do not claim CI-green or merged.
