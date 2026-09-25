# Orthodontic terminology and engineering references

Prepared 22 September 2026 for the braces-focused Dental Studio prototype. This document supports an interactive geometric editor and visual explanation of movements. It does not establish clinical movement limits or predict treatment response. Sources below are professional-body materials or original research; no commercial textbook has been downloaded or reproduced.

## Movement vocabulary

| Term                          | Meaning to preserve                                                                                                                                                                                                                                                         | Recommended editor meaning                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Translation / bodily movement | A pure translation changes position without changing orientation: crown and root share the same displacement vector.                                                                                                                                                        | Translate the complete tooth object by a vector in millimetres; leave its orientation unchanged.                                                                                       |
| Tipping                       | Tooth inclination changes. In an idealized controlled crown-tip movement the root apex is approximately stationary; uncontrolled tipping moves crown and root in opposite directions. Root movement with the crown approximately stationary is a different pivot condition. | Offer a clearly named **mesiodistal tip preview**, rotating around a buccolingual axis. Display the chosen geometric pivot. Do not call a crown-centred rotation “controlled tipping.” |

Translation, crown/root tipping, rotation-centre location, and force-system dependence are discussed in the original [Gholamalizadeh et al. study, PLOS ONE, 2021](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0259794).

| Term           | Meaning to preserve                                                                                                                                                            | Recommended editor meaning                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Torque         | Orthodontic usage can describe buccolingual root/crown inclination or the mechanical moment that produces that inclination. An angle in degrees is not a force moment in N·mm. | Offer **buccolingual inclination / torque preview** around the mesiodistal local axis. State whether the positive label describes crown or root direction. |
| Intrusion      | Movement in the apical direction, toward the root end.                                                                                                                         | Negative displacement along an explicitly defined root-to-crown axis.                                                                                      |
| Extrusion      | Movement toward the occlusal/incisal end, away from the root end.                                                                                                              | Positive displacement along that root-to-crown axis.                                                                                                       |
| Axial rotation | Rotation around the tooth’s longitudinal axis.                                                                                                                                 | Rotate around the tooth-local long axis, with a visible direction arrow. Keep generic world-X/Y/Z rotation as a separately named control.                  |

For torque terminology and the bracket/wire force couple, see the original [Lacoursiere et al. laboratory study, 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2951109/). For explicitly defined translational and rotational coordinates, see Methods §2.2 of [Vollenweider and Chavanne, 2025](https://onlinelibrary.wiley.com/doi/10.1111/ocr.70049). The latter is an industry-authored study of simulated aligner setups; its coordinate definitions are useful here, but its validation does not validate this app or braces biomechanics.

## Coordinate and pivot decisions

These are engineering recommendations inferred from the terminology above:

- Store calibrated directions for each tooth: toward the midline along its arch, toward the cheek/lip, and toward the occlusal/incisal end. Their opposites define distal, lingual/palatal, and intrusion. Do not infer these directions from FDI numbers alone on arbitrary uploaded meshes.
- Use patient right/left in FDI labels, not screen right/left. Upper and lower root-to-crown directions point oppositely in an articulated model. A single world-Y sign cannot represent extrusion for both arches.
- Name the axis convention and whether movement directions stay fixed to the initial model or follow the current tooth orientation. Save that choice with the case. Avoid silently switching conventions after rotation.
- Rotational signs must be shown with arrows and tooth-specific examples. “Positive torque” alone is ambiguous: buccal crown movement and buccal root movement have opposite implications for a fixed pivot.
- Keep the pivot as explicit geometry. A crown bounding-box centre, landmark, synthetic root point, or selection centroid is an editor reference, not a measured physiological centre of resistance.

The centre of resistance and centre of rotation are different concepts. The former depends on tooth/support anatomy and material behaviour; the latter also changes with the loading system. A universal pivot location for all teeth is not supported by the [2021 multi-patient finite-element study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0259794). That study itself makes simplifying assumptions, including an estimated centre of resistance; it must not be read as proof that a mesh centre is anatomically correct.

For a geometric rotation about a chosen point `p`, apply `x′ = p + R(x − p)`. For a translation use `x′ = x + d`. The distinction is testable without a clinical model. If the app supplies synthetic roots for illustration, mark them as synthetic; they are not reconstructed patient roots or evidence of root clearance.

## All-teeth and group movements

The following are product semantics, not claims about the force systems of fixed appliances:

| Operation                                             | Unambiguous behaviour                                                                                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move selected teeth in a world direction              | Add the same displacement vector to every selected tooth; preserve the group’s internal distances.                                                                                                                              |
| Move selected teeth buccally / mesially / intrusively | Resolve the requested direction independently in every tooth’s calibrated frame. Vectors can differ between teeth.                                                                                                              |
| Rotate each selected tooth                            | Apply the same angle separately about each tooth’s own axis and geometric pivot.                                                                                                                                                |
| Rotate a group as one object                          | Apply one rotation about a displayed group pivot; individual tooth centres move around that pivot. This is a different command.                                                                                                 |
| Expand an arch                                        | Define the rule explicitly. Buccal movement of all teeth is not identical to pure transverse expansion: anterior movement can be predominantly labial. State whether a number is displacement per side or total width increase. |

Resolve “all,” “upper,” “lower,” quadrants, anterior/posterior, and explicit lists to concrete IDs before applying. Include only teeth actually present. Show the affected count and IDs in the preview, reject empty selections, and commit a group action as one undoable transaction. Group presets should not imply anchorage control, periodontal feasibility, or coordinated root movement.

## Brackets and archwires: useful visual scope

The [American Association of Orthodontists glossary](https://aaoinfo.org/resources/glossary-of-orthodontic-terms/) describes brackets bonded to teeth, a wire seated in bracket slots, and retention by ligatures or self-ligating closures. A useful visual representation therefore attaches each bracket to its tooth and shows a connected archwire. Bracket positions and visible wire geometry can update with a geometric setup.

An engineering choice for this prototype is to redraw a wire curve through ordered bracket locations, with separate upper/lower wires. Call this a **braces visualization**. A curve drawn through the brackets contains no constitutive law, unloaded wire shape, slot contact/friction, force balance, or tissue response. Its visible shape cannot establish the force or moment delivered to any tooth.

In an original experimental study, actual bracket/wire geometry affected engagement play, while wire material affected torque expression. Nominal dimensions alone did not determine the measured response. See [Arreghini et al., Progress in Orthodontics, 2014](https://link.springer.com/article/10.1186/s40510-014-0053-x).

In a separate finite-element study, appliance materials changed tooth displacements and periodontal-ligament strains. The authors explicitly limited clinical extrapolation pending in-vivo validation. See [Papageorgiou et al., Progress in Orthodontics, 2017](https://link.springer.com/article/10.1186/s40510-017-0161-5).

**Engineering implication:** a future force simulation would need calibrated appliance/contact properties, supporting tissues, boundary conditions, numerical verification, and independent validation. Adding synthetic roots or a smooth wire does not supply those capabilities. Linear animation stages describe interpolation, not weeks, visits, biological movement rate, or achievable outcomes.

## Geometric measurements worth adding

| Measurement                        | Required data / honest label                                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooth displacement                 | Original and final transforms plus a named reference point. Report mm and the chosen coordinate frame.                                                                                          |
| Tooth inclination / axial rotation | Calibrated tooth axes and a declared angle convention; use degrees. A generic Euler component is not automatically a clinical inclination measurement.                                          |
| Intercanine width                  | User-confirmed left/right canine landmarks. State whether measuring the 3D distance or its projection into an arch reference plane.                                                             |
| Intermolar width                   | A named pair of homologous landmarks; cusp tips, fossae, and lingual points are different definitions.                                                                                          |
| Mesiodistal crown width            | Mesial and distal crown landmarks, not arbitrary tooth object centres.                                                                                                                          |
| Surface gap / intersection         | A mesh-to-mesh geometric computation with stated tolerance and mesh-quality limits. Centroid distance is not surface clearance.                                                                 |
| Overjet / overbite                 | Upper and lower teeth in a registered bite, anatomical landmarks, and specified horizontal/vertical reference directions. Display-only separation of the arches must not enter the measurement. |

An original digital-model validation study measured mesiodistal tooth widths, intercanine/intermolar widths, and Bolton analysis using defined acquisition and measurement methods. It supports these as useful measurement categories; it does not establish the accuracy of a different scanner, mesh pipeline, or this prototype. See [Suryajaya et al., F1000Research, 2021](https://pubmed.ncbi.nlm.nih.gov/33968366/).

The [American Board of Orthodontics digital Model Analysis guide](https://www.americanboardortho.com/media/5473/abo-model-analysis-02-23-2021.pdf) specifies anatomical landmarks for alignment and marginal-ridge evaluation. Its [Discrepancy Index instructions](https://www.americanboardortho.com/orthodontists/become-certified/clinical-exam/mail-in-cre-submission-procedure/case-report-preparation/discrepancy-index-instructions/) require casts in occlusion and define overjet using opposed anterior-tooth surfaces. These are reasons to request landmarks and a bite reference rather than label centre-to-centre distances as clinical measurements.

The [ABO Cast–Radiograph Evaluation](https://www.americanboardortho.com/orthodontists/become-certified/clinical-exam/mail-in-cre-submission-procedure/case-report-preparation/cast-radiograph-evaluation/) includes alignment/rotation, marginal ridges, buccolingual inclination, contacts, overjet, occlusal relationships, and root angulation. These are separate assessments. Crown-only meshes cannot determine actual root angulation; a visual wire cannot supply an ABO score. This prototype should not display automated diagnostic scores without a separately implemented and validated measurement protocol.

## Verification implications for the prototype

1. Translation preserves orientation and displaces every vertex by the requested vector.
2. Rotation preserves the selected pivot; changing the pivot visibly changes the path.
3. Upper/lower intrusion arrows point toward their corresponding root ends.
4. A positive tip/torque preview moves the declared crown/root side in the displayed direction on both left and right teeth.
5. Individual-tooth group rotation differs from rotation about a shared selection centre.
6. Undo restores every tooth affected by a group command in one step.
7. Wire/bracket overlays follow transformed teeth and never change tooth positions themselves.
8. Measurements use model coordinates and remain unchanged by camera movement, visual jaw separation, or wire visibility.

These checks verify geometric and interface behaviour. They do not constitute clinical validation. Keep movement limits labelled as editor limits, and do not derive universal force prescriptions or safe movement schedules from the papers cited here.
