status: open

# Phase 4.2 educator and visual acceptance

**Location:** [4.2 implementation and gate record](../../phases/phase-4-voice-lecture-assistant/4.2-tooth-study.md), `src/lib/tooth-anatomy/`, `src/components/case/ToothStudyCard.*`, `src/components/viewer/tooth-study-*`.

**Analysis:** The feature uses existing validated request execution, with strict local-only actions and stripped AI context. Data is separate from camera, labels and runtime state. Every changed allowlisted file shrank. Review caught and fixed close-then-explain selection ambiguity and stale study state during same-model case reset/variant/return; regression tests cover both. No unresolved code finding was identified in this scoped review.

**Outstanding acceptance:** This task prohibited browser/device checks. An educator must review all 14 arch/class content entries, root naming and morphology against the displayed synthetic model. The anatomy remains explicitly a teaching draft, not clinically validated.

**Auditor action:** Rerun root format, lint, format check and full build on the host. The sandbox denies access to `backend/.pytest_cache` during root scans and an ancestor directory during esbuild worker generation. Accessible-source checks and direct Next export are supplementary, not substitutes for those exact gates.

Then check both themes at 1600×900 and narrow widths, DPR 1 and 2; click through a prepared case, braces workflow and typed tooth commands. Inspect all six views of upper/lower teeth; confirm anatomical orientation, labels, apparent size, card scrolling, no tooth/HUD overlap, exact close/Undo/Redo camera restoration after resizing, workflow-to-case routing, clicker cycling and real speech interruption. Screenshot export still omits DOM labels/card/HUD, as documented.
