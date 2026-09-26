status: open

# Audit Phase 4.1 hands-free lecture control

Builder branch `ahmed/phase-4-voice-lecture-assistant` depends on draft PR #13 (`ed2164e`). The orchestrator prohibited git state changes; all changes remain uncommitted for review. Scope and evidence: [4.1](../../phases/phase-4-voice-lecture-assistant/4.1-hands-free-voice.md).

Please audit the wake gate, browser microphone lifecycle and shared runtime integration. No new TeachingActions were added. Coordinate the parallel 4.2 merge; it owns tooth-study action/schema/viewer changes.

Outstanding manual gate: real browser prepared case, braces workflow, typed command and normal/Present HUD in both themes at DPR 1 and DPR 2; real speech device/projector rehearsal, permission-denial and silence/restart behavior. These checks cannot be performed by this builder task and are not claimed as passed.

Automated result: 1,793 frontend tests, 482 backend tests; typecheck, lint, formatting and file limits pass. **Full build remains blocked** in the unchanged esbuild worker prebuild by an ancestor-directory permission error. Direct Next compilation/export passes but does not replace worker generation. Rerun `npm run build` with normal host access. Backend's only warning is an unwritable generated pytest cache.

[ADR 004](../../decisions/004-hands-free-voice.md) records the owner-authorized privacy decision and an explicit spec conflict: recognition pauses during narration, so it cannot hear spoken Stop then. Verify Stop/Escape/hold-to-talk interruption during output and bare Stop during active playback. Broader open CSS/props/Try Mode follow-ups remain outside this feature.
