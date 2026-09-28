# Handoff — crown/root movement trails

**Branch:** `ahmed/phase-3-crown-root-trails` · **Base:** PR #19 at `59750c5` · **Phase:** [3.20](../phases/phase-3-demo-path/3.20-crown-root-trails.md) · **PR:** pending

The owner approved only crown/root points and paths from the suggested improvements. Further lecture features/content are deferred until the professor's demo, approval and supplied lectures/cases. Existing sample and lecture behavior remain intact.

The existing Displacement traces switch now shows solid crown and dashed root paths for the primary selected tooth. Paths share the exact displayed source; labels and distinct markers are in the canvas. Scrub/reverse reveal no future movement, hidden results reveal no paths, and roots require actual visible root geometry. Sampling/resource setup is outside RAF, with reusable buffers and explicit disposal. The runtime context restriction found during review was fixed and covered through actual validation. Colours adapt to both existing themes.

All local automated checks passed: 2,674 frontend tests across 126 files (204.64s), 619 backend tests (11.03s), typecheck, zero-warning lint, full formatting/check, 452-file limits, production build, offline assets and whitespace. Thirty tests added; none removed. Node 22.23.3 and Python 3.13.3 were used. The first typecheck caught an obsolete tooth-study prop, corrected with its test expectation before the passing gate. Independent final source review found no remaining actionable issue. Studio, Viewer and the context simulator all shrink; no new exception.

Main was freshly fetched and already integrated at `dfd377f`. Static output was rebuilt; the existing `127.0.0.1:3012` listener remains active. Primary checkout remains clean at `ff1b3e5`. No backend, locks, model assets, generated audit input, STATUS or AGENTS changes.

Remaining visual checks are blocked by the earlier security restriction on local app inspection; do not bypass it using a different browser, local HTTP or automation route. The draft dependency stack requires ordered auditor review and applicable CI; main-targeted CI does not trigger on this stacked base. No new lecture work is authorized by this feature request, and the broader goal's previous acceptance blocker is not resolved by these source changes.
