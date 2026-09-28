# Qualitative periodontal remodeling illustration

**Date:** 2026-09-27 · **Branch:** `ahmed/phase-3-lecture-mechanics` · **Scope:** primary-source research and an independent teaching diagram. This is not clinical validation of Forma or a tissue simulation.

## Evidence and limits

| Primary research                                                                                                               | Finding used                                                                                                                                       | Limit on interpretation                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Otero et al., 2016 — human periodontal ligament](https://pubmed.ncbi.nlm.nih.gov/26823650/)                                   | Loaded human premolars had increased RANKL protein, with greater compression-side concentrations. Responses were also detected on tension sides.   | Molecular signals are not exclusive to one side. This does not establish a stress threshold, rate or predictable outcome for the app's tooth geometry.                                |
| [Yang et al., 2018 — RANKL deletion](https://pubmed.ncbi.nlm.nih.gov/29483595/)                                                | In mice, deleting RANKL in PDL and bone-lining cells greatly reduced osteoclast formation and orthodontic movement.                                | An animal mechanism study supports a role for cellular signaling; it does not calibrate a human treatment forecast. PDL fibroblasts must not be depicted as turning into osteoclasts. |
| [Mao et al., 2018 — tension-associated bone formation](https://pubmed.ncbi.nlm.nih.gov/29224185/)                              | A rat model showed increased bone formation and osteogenic markers at tension sites under loading.                                                 | It supports the teaching association, not a universal rule, human timescale or guaranteed rate.                                                                                       |
| [Cattaneo et al., 2009 — sample-specific finite-element analysis](https://pubmed.ncbi.nlm.nih.gov/19419455/)                   | Human-jaw models incorporating nonlinear PDL behavior and actual bone morphology did not reproduce clean, symmetrical tension/compression regions. | A tooth cannot be divided into two universal response zones from movement direction alone.                                                                                            |
| [Cai et al., 2015 — canine translation, inclination and rotation](https://link.springer.com/article/10.1186/s12903-015-0091-x) | Inclination produced opposing cervical/apical stress regions; axial rotation produced a different distribution in this particular model.           | Findings depend on modeled anatomy, loading and material assumptions. They are not a reusable biological map for every tipping or rotation animation.                                 |
| [McCormack et al., 2014 — PDL fibers](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0102387)               | Including fibers changed the magnitude and distribution of predicted alveolar-bone strain.                                                         | Simplifying the PDL changes modeled load transfer; simple mechanical output must not be labeled measured tissue stress.                                                               |

These studies support the concise associations **compression-associated signaling and local bone resorption**, and **tension-associated signaling and local bone formation**. They do not support exclusive two-zone biology, an optimal-force prescription, a patient-specific remodeling timeline, or deriving a tissue field from a displayed tooth displacement.

A prescribed path defines position and orientation. A mechanical analysis relates a specified force system, support and material assumptions to a modeled response. Neither alone establishes subsequent biological remodeling. This distinction informs the implementation; it is not a claim that Forma solves the primary papers' finite-element models.

## Existing app behavior

- `src/lib/teaching-anatomy.ts` already provides root-following schematic bone and an enlarged PDL sleeve. Supporting tissues deliberately remain at their reference pose as the tooth moves.
- `src/components/viewer/AnatomyPanel.tsx` already explains that exaggeration and fixed support geometry.
- `src/lib/workflow-scene.ts` already teaches supporting anatomy, translation, tipping and comparison. The tipping pivot is geometric, not a calculated centre of resistance.
- `src/lib/workflows.ts` already links experimental remodeling evidence. The new diagram adds local cellular-response explanation rather than another anatomy or motion lesson.

## Bounded diagram

`src/lib/teaching-biology.ts` holds captions, limitations and primary citations. `RemodelingDiagram.tsx` provides presenter controls; its exported `BiologyIllustration({ view, audience? })` is the shared display. Set `audience` to render source labels and evidence types as text, with no interactive links. `BiologyView` is `overview | compression | tension`.

Two separate SVG vignettes show a root surface, exaggerated PDL space and adjacent alveolar bone. Compression uses inward arrows and an osteoclast at a scalloped **bone** surface. Tension uses outward arrows, osteoblasts and a patterned new-bone band. Cell shape, labels and patterns carry meaning alongside color. These are local conceptual examples, not opposite sides assigned to the live tooth.

Persistent caption: **Illustrative tissue biology; not a stress map or prediction for this model.** Width, cell size and depiction are deliberately qualitative. No treatment days, numeric pressure scale, biological speed, root damage forecast or promise of outcome is shown.

The component accepts no model, transforms, force values, mechanics results or elapsed time. It cannot update the scene, solve mechanics or control playback. The presenter requests a focus or close through callbacks; the parent owns state. Lecture integration can place it in the existing context panel and preserve its state with the lecture return snapshot. This component adds no top-level mode, second playback strip or live 3D stress overlay.

## Verification

Targeted content and DOM tests cover cell/response distinctions, primary-evidence labels, controlled focus/close actions, scope and citations in every view, a read-only audience rendering and unique accessible SVG references across simultaneous displays. **10/10 tests passed** across the two new test files with one worker. Scoped formatting and zero-warning ESLint passed; full integration gates belong to the coordinating session.

Live browser tools are blocked by security policy. No browser appearance, projector readability, DPR checks or clinical educator review is claimed. Those remain separate acceptance work.
