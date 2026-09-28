status: open

# Gingiva and bracket placement acceptance

**Phase:** [3.22](../../phases/phase-3-demo-path/3.22-gums-and-bracket-placement.md) · **Branch:** `ahmed/phase-3-gums-brackets` · **Dependency:** draft PR #21.

**Analysis:** the atlas gum meshes had no tooth-following deformation, only whole-arch separation. Bracket slot coordinates existed in the state model but had no placement editor, and the wire's neutral shape was rebuilt from edited slot positions; simply exposing that field would hide the intended bending activation. Angle data also need to survive every persistence, command-context, rendering and backend boundary.

**Corrections:** use viewer-owned, rest-based gum deformation with tapered surface influences and preserved source attributes. Keep the wire's original slot curve immutable; project bond locations onto crowns, apply in-plane angle to display and seated beam slope, and preserve neutral legacy defaults. Share solve eligibility with the editor and runtime. A reset that removes the sole activation must not append an invalid passive solve. Exact committed coordinates must survive an angle-only edit. Optional Analyze facts preserve legacy request shape rather than silently adding defaults to old payloads.

**Integration findings:** existing dental arrangements stored an arch offset in both the gum origin and tooth poses. Applying a new follower doubled that offset. Their rigid registration now belongs to matching tooth/gum rest origins; individual poses retain only individual changes. Actual world-position and saved mechanics checks cover that representation. Saved meshes also lack derived bounding boxes, so following must calculate missing bounds before using them. Cold binding preparation blocked the first scene for several seconds; generated bindings for the released model remove that calculation from the normal demo startup.

**Auditor action:** inspect all revised contracts and the independent force benchmark. Verify actual gum appearance and playback on the released atlas at DPR 1/2, jaw opening, root visibility, both arches, prepared demonstrations and magnified mechanics. Check that the base remains stable, normals have no seam artifacts and larger movements remain presentable. Click bracket height/side/angle, Apply, Reset, Undo, stage restore and saved-case reload; confirm slot-wire registration. Check a prepared case, braces workflow, typed calculation command, audience projection and real device performance.

The biology limits and existing independent elastic endpoint semantics are explicit in the phase doc. User-facing controls do not describe in-plane angle as prescription torque. Browser/device acceptance remains pending because the prior security rejection is still binding; do not bypass it. Keep the stacked PR draft until the acceptance gap and applicable CI are resolved.
