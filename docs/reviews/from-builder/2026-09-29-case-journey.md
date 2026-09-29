# Case journey: review and acceptance

status: open

Branch: `ahmed/phase-3-case-journey`, based on PR #26 (`b839f7b`).

## Verified findings and fixes

Wire activation works through actual-Atlas UI/runtime/solver/display tests. Resetting a solved wire to zero did not: an unconditional Solve rejected the passive configuration and rolled back the whole request. `WireActivationControl` now evaluates the proposed configuration with shared activation eligibility. Tests retain recalculation when a bracket/other activation remains. This is the second occurrence of lesson 38; promote its proposed-configuration rule into AGENTS.md through the required jointly agreed PR. No unilateral governance edit is included here.

Independent source review caught and addressed an A/B jaw-pose mismatch, mismatched Return button copy and a malformed duration string. Content review clarified that the illustrated anterior bonded retainer does not establish a complete posterior/transverse retention plan. The three authored movement paths were refined until all nine samples per path had no displayed upper crown/root surface intersections; both-arch overview poses are checked separately with their jaw display transforms.

## Auditor acceptance

- Review motion schema/absolute restore, paired start/finish comparisons, jaw/camera consistency, input-only mechanics detours and exact Return/Undo/Redo.
- Run the complete local/CI gate against the final PR head and dependencies. Check browser at 1600x900, DPR 1 and 2: featured case, all hardware steps, Play/seek/reverse, initial/finish comparison, bracket workflow, typed command, active-wire calculation and exact Return.
- The previous automatic security review rejected local-browser inspection and workarounds for this task. No fresh browser/GPU screenshots or device acceptance is claimed. Keep draft until resolved acceptance and CI requirements are met.

## Professor review before claiming approval

1. Confirm the hypothetical diagnosis, growth assumptions and assessment discussion.
2. Inspect expander attachments, clearance and the authored dental widening depiction.
3. Approve the sequence and reassessment points for this scenario.
4. Check the distinction between initial elastic calculation and authored progress.
5. Define finishing objectives and a complete retention discussion, including posterior/transverse retention beyond the illustrated anterior wire.
6. Check initial/final views for misleading occlusion or jaw-position implications.
7. Record reviewer, date and requested corrections before changing the review-pending label.

Existing unrelated case-prop, try-mode and CSS cleanup items remain open; the wire editor extraction overlaps this task and makes MechanicsPanel smaller.
