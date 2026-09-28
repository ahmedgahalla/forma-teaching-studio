status: open

# Claude tooth diagram acceptance

**Phase:** [3.23](../../phases/phase-3-demo-path/3.23-atlas-tooth-diagram.md) · **Branch:** `ahmed/phase-3-atlas-tooth-diagram` · **Dependency:** draft PR #22.

**Analysis:** Forma's prior chart approximated the requested source with generic tooth icons. Claude's actual chart derives crown/root curves and widths from atlas dimensions, reverses lower teeth vertically, and preserves quadrant boundaries. A simple icon swap without those contracts would lose the requested diagram and collapse missing-tooth positions.

**Correction:** port the original paths as immutable precomputed data, retain explicit quadrant slots and existing action handlers, and use source-style crown/root treatment within Forma's theme. An independent source-output digest covers all 32 drawings. DOM tests cover ordering, extraction spaces, optional wisdom positions and interaction boundaries. Read-only independent review found one obsolete mobile padding override, removed in this PR; no other source-level blockers were found.

**Auditor action:** compare the actual bottom chart against Claude's source at desktop and phone widths, at DPR 1/2, with both themes and the extraction lecture's Explore detour. Check root lines, crown proportions, R/L and FDI labels, selected/hidden/moved states, missing-tooth spacing and native focus. Exercise a prepared case, braces workflow and typed command. Confirm the larger chart does not crowd the model or playback on a short screen.

Browser acceptance and screenshots remain pending because the earlier security rejection prohibits local-browser inspection and workarounds. Keep the PR draft until that acceptance and applicable CI are complete. Source parity is not a claim of pixel equivalence or clinical validation.
