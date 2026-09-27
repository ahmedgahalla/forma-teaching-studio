status: open

# Teacher lecture workflow — integration review and remaining acceptance

**Branch:** `ahmed/phase-3-teacher-lectures`.

**Analysis scope:** the existing Phase 4 command/runtime, case capture/restore, geometry references, prepared demonstrations, storage and layout seams before and during Phase 3.9 integration. Claude's Phase 4 work at `ff1b3e5` is the base; it is not newly authored work in this feature diff.

## Corrected during implementation

- Related glossary clicks used a context-free action plan, changing a studied tooth to the authored default while equivalent typed commands retained the current tooth. The button now uses the same context-aware planner; a regression compares the actual click with the parsed request.
- Durable lecture snapshots need both visible transforms and the source model identity. Reopening a static prepared-case scene must preserve registered origins and omitted teeth. The session retains source identity independently of active playback; bridge tests verify the source override.
- A calculated scene cannot be rebased by replacing only mechanics reference transforms. Capture now reconstructs reference teeth and axes from the visible pose, retains appliance inputs, and discards calculated results. The saved step is a static illustration.
- Lecture return must preserve presentation state as well as the model. The paused return includes answer and notes visibility; tests alter these during exploration before returning.
- Structural lecture edits clear obsolete runtime history so Undo cannot reference a deleted step. Document deletion requires confirmation; backups provide recovery, and imported backups create independent copies.

## Auditor acceptance still required

**Blocking for merge:** a real browser walkthrough and screenshots at 1600×900 with DPR 1 and 2. This session's browser security policy rejected access to the running preview and explicitly prohibited alternate-surface workarounds. No browser, projector, real microphone or timed-demo pass is claimed. Source/DOM/runtime tests do not replace that gate.

Verify a prepared demonstration, braces workflow in Explore, a typed command, and the complete custom-lecture journey: create/reorder three steps, capture, save/reopen, teach, pause halfway, explore a question, return, export/import. Check actual tooth occupancy, notes/readability, focus, panel scrolling, small-screen controls, and that exactly one playback bar is active. Verify the prepared model identity survives detach/capture/reopen. Notes shown on the single window are visible to the audience.

The default local frontend gate encountered the existing real-GLB oracle timeout and worker startup timeouts. Root records final controlled-run results in the phase doc. Do not weaken the oracle or label an incomplete gate green. CI and all repository merge conditions remain required.

**Dependency:** Phase 4's unchanged base and PR #13 must be audited and integrated in order. This feature must not silently replace Claude's branch or bypass the auditor-owned STATUS/merge workflow. Existing broad CSS, Try Mode split and case-prop cleanup remain separate, except for the shell extraction necessary for this integration.

**Suggested resolution:** record the actual browser evidence, dependency disposition and CI results in the audit; resolve this item only when the requested acceptance has been performed or explicitly dispositioned by the owner.
