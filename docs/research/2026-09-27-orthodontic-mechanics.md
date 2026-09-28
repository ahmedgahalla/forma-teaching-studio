# Orthodontic force-system teaching examples — 27 September 2026

## Research question and scope

Which additional Explore controls would help a lecturer explain force systems without claiming that Forma predicts patient treatment? Research preceded implementation. The existing app already demonstrates geometric translation, tipping, torque, rotation, intrusion and extrusion; this collection adds prepared **loads**, with the existing bounded solver determining their initial elastic response. It adds no new solver physics, clinical targets, treatment timing or lecture authoring.

## Primary sources and supported conclusions

- [Smith and Burstone, 1984, _Mechanics of tooth movement_](https://pubmed.ncbi.nlm.nih.gov/6585147/). This biomechanical analysis explains force resultants, the moment produced by a force acting away from the center of resistance, and a couple formed by equal opposite parallel forces at separate points. These concepts motivate the pull/counter-couple and rotation examples. Forma balances moments about its declared **virtual spring origin**, which is not a patient-specific center of resistance. No clinical moment-to-force ratio is copied from this paper.
- [Gholamalizadeh and colleagues, 2021, _A multi-patient analysis of the center of rotation trajectories using finite element models of the human mandible_](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0259794). The three-patient finite element study examines how loading direction and geometry affect modeled centers of rotation. It supports teaching dependence on assumptions rather than presenting a universal numerical ratio. Its tissue representation and finite element model are not implemented in Forma; its results do not validate Forma's support positions or stiffnesses.
- [Çifter and Saraç, 2011, _Maxillary posterior intrusion mechanics with mini-implant anchorage evaluated with the finite element method_](https://pubmed.ncbi.nlm.nih.gov/22051501/). In the modeled posterior segments, simultaneous vestibular and palatal loading produced more balanced intrusion than the examined buccal-loading configurations. This motivates contrasting load placement. Forma's single-molar example is a different simplified rig: it does not reproduce the study, calculate tissue stress, predict root resorption, or prescribe force values or insertion sites.
- [Arreghini and colleagues, 2014, _Torque expression capacity of 0.018 and 0.022 bracket slots by changing archwire material and cross section_](https://link.springer.com/article/10.1186/s40510-014-0053-x). This bench experiment found that actual component dimensions and edge geometry change play and torque expression; nominally matching components can behave differently. Material stiffness affects the moment after engagement. Forma therefore labels its sharp-corner slot calculation as ideal. The example contrasts size and material under one authored total end twist; it does not predict the torque of a commercial bracket-wire combination.

No source figures were copied, traced or downloaded. All scene configurations are authored against the existing synthetic asset.

## Implemented collection

| Example                         | Variations                                          | Target and teaching comparison                                                                          |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Crown pull                      | Buccal / lingual                                    | Selected tooth; a crown load gives both force and moment about the virtual support.                     |
| Pull with a counter-couple      | Balanced / half counter-couple                      | Selected tooth; same net force with full or partial cancellation of the rig's crown-load moment.        |
| Axial rotation couple           | First / reverse direction                           | Selected tooth; equal opposite loads cancel resultant force and reverse the long-axis moment.           |
| Buccolingual inclination couple | First / reverse direction                           | Selected tooth; a different couple plane changes the rotation axis.                                     |
| Intrusion and extrusion         | Intrusion / extrusion                               | Selected tooth; reverse an axial load along its calibrated anatomical axis.                             |
| Molar intrusion balance         | Buccal side only / both sides                       | Selected molar, otherwise tooth 16; distribute the same total load to reduce its moment.                |
| Reciprocal and fixed anchorage  | Tooth / ideal fixed anchor                          | Teeth 13 and 16; preserve the pull on 13 while moving the reaction from 16 to a schematic fixed anchor. |
| Wire twist and slot play        | Larger steel / smaller steel / larger beta titanium | Teeth 13 and 16; same total relative end twist, different ideal engagement and stiffness.               |

Eight examples contain seventeen variations. The first five work on the selected calibrated synthetic incisor, canine, premolar or molar. The UI names the target IDs before loading. Fixed targets are validated in the current model; no example silently loads another model or resets tooth anatomy.

## Implementation and boundaries

- `src/lib/mechanics-examples/catalog.ts` stores the choices and target rules; `factory.ts` builds validated existing bracket, elastic, ideal fixed-anchor and wire actions. No changes to the solver algorithm.
- Loads are authored software examples: ordinary pull/axial load 0.2 N, balanced intrusion two 0.1 N loads, couples with 4 mm separation, and schematic fixed points 12 mm along each chosen force direction. Counter-couple magnitude is calculated from the current virtual lever arm. These numbers are not clinical recommendations. Crown-local load points may lie inside synthetic geometry and are schematic, not attachment or surgical-placement instructions.
- The wire rig uses a single 13–16 span, a 16-degree total relative end twist, and ideal 0.019 × 0.025 or 0.017 × 0.025 inch rectangular sections. The existing solver accounts for clearance at both span ends. These settings were chosen to demonstrate engagement within its existing strain limits. No wire bending, sliding friction, bracket wear, biological adaptation or appliance-specific manufacturing tolerance is newly modeled.
- A local-only `mechanics-example` action carries a catalog ID and named variation. The optional AI interpreter cannot author or execute it. Visible choices, complete typed commands and recognized voice transcripts share validation and execution.
- Loading replaces the appliance configuration as one undoable request. An unresolved movement preview, locked target, prepared read-only scene, guided tooth study or unsupported model is rejected. The first rig uses the current endpoint; partway geometric playback must first return to Show after. Further rigs use the same existing unloaded mechanics reference, so comparisons do not accumulate calculated movements.
- The existing worker, cancellation handling, response magnification, prediction/reveal controls, six sampled crown-crossing checks and whole-request history are reused. A late worker result after Stop cannot publish the new rig. Calculations remain initial elastic responses with declared virtual supports, not tissue stresses, bone remodeling, biological time, patient outcomes or clinical validation.

## Verification evidence and remaining review

Focused tests cover all seventeen recipes on the shipped GLB/metadata, deterministic repetition, baseline and ID preservation, supported save-input validation, force balance, couple reversal, anatomical intrusion/extrusion direction, counter-moment cancellation, anchorage reactions and wire engagement/material comparisons. Runtime tests cover undo/redo, retained unloaded references, preview and lock rejection, late-result cancellation and calculation failure. Component and grammar tests compare clicked choices with displayed typed/voice instructions, including local-only enforcement and strict external action validation.

Browser checks remain unavailable under the session's explicit browser-policy restriction. Projection readability and the visible schematic load-point placement still require an authorized browser review and an orthodontic educator's review; neither is claimed complete here.
