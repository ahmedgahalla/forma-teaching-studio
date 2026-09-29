# Tooth chart and lecture clarity: review and acceptance

status: open

Branch: `ahmed/phase-3-chart-lecture-clarity`, based on PR #28 (`417c3a2`).

## Findings addressed

The reported chart/model overlap comes from incompatible nested minimum heights combined with visible overflow. The voice viewport required 290px while the stage could allocate 220px or less under later responsive rules. The stage now owns the minimum, the child fits its allocated row, and the workspace scrolls. This repeats lesson 42: inherited and responsive selectors must be checked across the complete component boundary.

The chart had selection clicks but no preview, and the additive selection shader had almost no front-facing brightness. Local hover/focus state now drives a distinct warm preview without runtime mutations. Selection remains stronger, shared materials preserve enamel, and source geometry is not disposed by the overlay owner.

Lecture mode names and hidden step counts did not explain the intended workflow. Clear review/present labels, capability-based step instructions and paused-step context retain existing validated actions, notes privacy, reveal gating and one playback bar. Typed/voice aliases match the new visible labels.

## Verification

The final automated gate passes: **3,073 frontend tests in 171 files**, **659 backend tests**, TypeScript, ESLint with zero warnings, Prettier, file limits (558 files), production static build and offline demo-asset checks. There are 27 added frontend cases and no removed test cases; highlight assertions moved from tissue-material coverage to the dedicated glow owner tests. The first full run mixed old clarification code with an updated expectation during the final copy edit and failed four assertions. The fresh affected suite passed all 88 tests, and the complete rerun against frozen code then passed. Source/DOM and pure Three.js evidence cannot establish visual quality or GPU rendering. Previous automatic security review rejected local-browser inspection and workarounds; no screenshots or browser evidence are claimed.

## Auditor action

- Review the independent stage minimum and complete desktop/mobile cascade, including inspector-open/closed and lecture returns.
- Check chart hover and keyboard focus against actual 3D glow at DPR 1 and 2, both themes, roots on/off, hidden arches and multi-selection. Capture before/after 1600x900 plus short/narrow window evidence.
- Run a prepared case, braces workflow and typed command. Exercise Review notes, Present, named steps, authored playback, the wire-experiment detour/return, comparison exits, revealed answers and audience privacy.
- Run CI against the final head and dependencies; keep draft until browser acceptance and CI pass. Main-targeted CI does not automatically run on this stacked base.
- Lesson 42 is now a second occurrence. For the required joint AGENTS.md agreement, propose this shared rule: when changing workspace layout, inspect all inherited and responsive sizing rules for both parent and child, and verify minimum sizes, scrolling and sibling placement at the affected breakpoints. The builder has not edited AGENTS.md unilaterally.

Broader auditor cleanup items remain open; this slice does not resolve them wholesale.
