# Prepared teaching cases and contact audit

The twelve cases are authored synthetic examples using the adult 28-tooth reference asset. Their nineteen demonstrations show different geometry: translation and three rotations, sequential alignment, two midline outcomes, translation versus inclination, a local crossbite path, intrusion versus posterior extrusion, reduction of anterior separation, unilateral posterior repositioning, two allocations of extraction space, staged finishing, and passive removable retention. Reference inspection and retention deliberately hold their arrangements still.

Each case includes a learning goal, assumptions, discussion questions, answers and source links. These examples do not diagnose a case, select treatment, calculate appliance mechanics, predict tissue response or turn free workspace edits into a treatment plan. Playback progress is a geometric interpolation fraction, not elapsed biological time.

## Geometry contract

`createTeachingCase(base, id)` accepts the complete calibrated synthetic adult reference and returns `{model, transforms, selectedIds, definition}`. It copies metadata and poses but borrows the immutable crown, root and gum geometry buffers. The caller retains ownership of those buffers. Supply the original reference, not a previously registered teaching case.

`CASE_REFERENCE_SHIFT` is 1.6 mm: upper tooth and gum origins shift down by this amount and lower origins shift up by the same amount. This brings the arches together for illustration; it is not a reconstructed bite record or evidence of ideal occlusion. Geometry buffers and tooth coordinate axes remain unchanged.

`sampleCaseDemonstration(caseId, variantId, progress)` returns complete pose offsets relative to that registered model. It always samples the prepared baseline and authored keyframes. Do not add its result to current sandbox offsets. Translation is linear between waypoints; orientation uses quaternion interpolation. Crown and root share the same rigid transform and crown-centred pivot.

Only the anchorage example omits teeth: upper first premolars 14 and 24. Its retained gum surface is schematic, not a healed extraction socket. The diastema example separates upper half-arches and compares a centred versus shifted upper-arch endpoint; this deliberately affects dental width as well as the midline. The anterior-crossbite path includes small display-clearance waypoints. These constructions are stated explicitly in their case assumptions.

Removable retention uses `removableRetainer: true` with the ordinary appliance preset `none`. It must not silently become the fixed lingual-retainer preset. The teeth stay still; the display supplies neither a wear schedule nor fabrication geometry.

## Published contact data

Import `src/lib/teaching-case-audit.json` synchronously. It records the GLB and metadata SHA-256 hashes, the teaching-case source hash, reference registration, sampling method and limitations. `cases[caseId].baseline` contains `crownPairs` and `rootPairs`; `cases[caseId].variants[variantId]` contains `sampleCount` and `frames`. Each frame provides `progress`, crown/root pairs and the pairs newly present relative to that case's baseline. A pair is `{a, b}` in FDI notation.

The audit loads the shipped **Blender GLB** through the actual anatomy asset loader. It checks exact triangle-surface intersection at nine evenly spaced progress values and every authored keyframe, deduplicated. Unchanged pairs reuse their measured result from the registered reference; every pair with a changed tooth is tested at its sampled poses. Crowns and roots are tested separately. Tests verify report coverage, pair validity and provenance hashes.

The registered reference has no measured crown or root surface intersections. Prepared crowding and posterior-crossbite examples include known crown crossings. The posterior-extrusion alternative develops opposing molar crossings because both jaw frames stay fixed; the path does not invent a jaw rotation to hide this limitation. The published JSON is the authoritative list of exact pairs and affected samples.

Show known pairs as **illustrative contact crossings**. A union across a variant's frames identifies teeth involved somewhere in the sampled path; it does not establish a live intersection at the current unsampled time. After workspace edits, these prepared-path results no longer describe the edited arrangement.

This is not swept collision detection or clearance measurement. It does not assess crossings between samples, fully enclosed volumes, crown–root pairs, gingiva, bone, supporting tissues, appliance clearance or biological feasibility. An empty list does not validate a path or a bite.

Regenerate from the project root after changing the asset, its metadata or authored case paths:

```powershell
node --experimental-strip-types scripts/audit-teaching-cases.mjs
npm test -- src/lib/teaching-cases.test.ts src/lib/teaching-case-audit.test.ts
```

## Source scope

Terminology and relationship labels follow the [AAO glossary](https://aaoinfo.org/resources/glossary-of-orthodontic-terms/) and [AAO crossbite explanation](https://aaoinfo.org/whats-trending/what-is-a-crossbite/). Finishing discussion draws on the separate assessment domains in the [American Board of Orthodontics evaluation guide](https://www.americanboardortho.com/media/vildsvsv/grading-system-casts-radiographs.pdf); the application does not calculate a board score.

The deep-bite case links a [maxillary intrusion-arch trial](https://pubmed.ncbi.nlm.nih.gov/33378499/) and a [bite-plane trial in growing patients](https://pubmed.ncbi.nlm.nih.gov/39195127/) to illustrate why isolated geometric paths omit clinical effects and patient context. Neither trial supplies the app's authored displacements. The anchorage comparison links a [trial measuring anterior retraction and molar anchorage changes](https://pubmed.ncbi.nlm.nih.gov/36919990/); its two movement allocations are chosen display values, not trial-derived force ratios. The retention case uses the [British Orthodontic Society's distinction between removable and bonded retainers](https://archive.bos.org.uk/BOS-Homepage/Orthodontics-for-Children-Teens/Treatment-brace-types/Retainers).
