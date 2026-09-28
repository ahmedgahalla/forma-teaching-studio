status: open

# Jaw and selection-glow acceptance

Phase [3.26](../../phases/phase-3-demo-path/3.26-jaw-and-selection-glow.md) ports the owner-selected Claude jaw hinge and additive selection glow into the existing runtime. The anatomy asset and metadata remain unchanged.

Source analysis found that simply parenting lower meshes to a hinge would leave existing camera, gum-following, picking and overlay helpers in inconsistent coordinate frames. The implementation instead shares an explicit lower-jaw display transform and inverse edit conversion. CPU geometry tests cover the real Atlas gum path, independent hinge equations, upper/lower separation, trails, anchors and framing. Runtime tests cover local authority, Undo and lecture restoration. No Blocking finding remains from these checks.

Please perform the still-missing browser/GPU acceptance: Explore → Display jaw toggle, Lecture → View toggle, typed `open jaw` / `close jaw`, prepared case, braces, lower bracket placement/handles, gums after a tooth movement, multiselection glow, isolated study, themes and DPR 1/2. Confirm clinical-theme glow visibility, opened-jaw fit and audience capture on the actual projector/browser. The jaw uses two deterministic poses; the camera retains its normal transition.

Earlier automatic security review rejected local-browser inspection and workarounds, so fresh screenshots and live acceptance could not be produced. Keep the PR draft until those checks and applicable CI pass. The preceding AI provider choice remains pending and is not part of this geometry change.
