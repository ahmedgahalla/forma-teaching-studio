# Blender teaching anatomy

This is an original, editable teaching asset generated from Forma's procedural anatomy and refined in **Blender 5.1.1**. The current morphology revision is `permanent-landmarks-2`; the file names retain `v1` because the loading/coordinate contract remains compatible. It contains no patient scan or third-party mesh. Crown classes, root branches and supporting gingiva are schematic, not a reconstruction or a clinically reviewed model.

## Deliverables

| File | Purpose |
| --- | --- |
| `forma-teaching-v1.blend` | Editable Blender source containing the 58 runtime objects. |
| `forma-teaching-contact-sheet.png` | Blender render of linked copies of the delivered surfaces: complete dentition, upper/lower occlusal views, and representative crown/root forms. |
| `forma-anatomy-landmarks.png` | Closer overview of all fourteen upper/lower permanent tooth classes, with their roots. |
| `../../public/models/forma-teaching-v1.glb` | Browser asset with 28 separate crowns, 28 root meshes and two gingival meshes. About 3.86 MB. |
| `../../public/models/forma-teaching-v1.json` | Original tooth pivots, anatomical frames, bracket anchors, mesh names and asset manifest. |
| `verification.json` | Checks run against the exported GLB through Three.js, including topology, registration and appliance compatibility. |

The .blend is saved before the temporary contact-sheet layout is built. The presentation duplicates are not part of the runtime file. The application supplies its own display materials; the source also includes neutral enamel, dentine and gingiva materials for authoring and inspection.

## Refinement and mesh budget

The Blender script sculpts anterior labial lobes, lingual fossae, cingula and marginal ridges in calibrated tooth coordinates, rounds distal incisal corners and adds a shallow scalloped cervical junction. Posterior anatomy has distinct cusp pairs, a three-cusp lower second premolar, maxillary oblique ridges, a smaller upper second-molar distolingual cusp and lower five-/four-cusp molar patterns. A protected labial patch keeps the original bracket registration.

Roots have fuller middle thirds, a curved apical sweep and a rounded terminal taper. Multi-root teeth have an actual voxel-unioned cervical trunk and furcation, not disconnected tapered pieces hidden inside one named object. Crown meshes are never voxel-remeshed. Alternating fairing reduces triangulation ripple; bounded decimation removes redundant triangles without blanket subdivision.

| Part | Triangles |
| --- | ---: |
| 28 crowns | 114,688 |
| 28 root objects | 73,168 |
| Two gingival meshes | 23,596 |
| **Total** | **211,452** |

The original input contains 406,304 triangles. The delivered asset remains below the 250,000-triangle budget. Each tooth's root surface is connected; optional `rootAnatomy` metadata identifies its trunk and distal branches for the schematic socket/ligament generator. The support envelopes remain approximate illustrations, especially around furcations; they are not a segmented periodontal space.

## Runtime coordinate contract

- Metadata version: `1`; units: `mm`.
- World coordinates: **+X patient left, +Y superior, +Z anterior**.
- GLB numeric coordinates are deliberately millimetres for the application's case convention. Do **not** multiply by 1,000 based on glTF's usual metre convention.
- Nodes are `crown_11`, `root_11`, and so on for the 28 permanent teeth excluding third molars, plus `gum_upper` and `gum_lower`.
- Clone each loaded mesh geometry, apply its complete `matrixWorld`, then subtract the metadata tooth `position`. Use the same original pivot for its crown and root. Do not recenter either mesh by its refined bounding box.
- Gingiva uses position `[0, 0, 0]`. Keep tooth `buccal`, `mesial`, `occlusal`, `bracketPosition` and `calibrated` metadata unchanged.
- Optional `rootAnatomy` has `{version:1, trunk?:RootSection[], branches:RootSection[][]}`. A section is `{center:[x,y,z], radii:[right,buccal]}` in millimetres. Its center uses the same local case-XYZ frame as the crown/root mesh; right is `rootward × buccal`. Sections advance rootward. Absence keeps the legacy mesh-plane extraction path. The loader validates and copies these arrays.
- Blender authoring is Z-up: case `(x,y,z)` is stored as `(x,-z,y)`. The Y-up GLB export reverses this conversion; the verification script checks the result.

## Rebuild

Run from the `dental-studio` folder with Node 24 and Blender 5.1 installed. The paths below are an example using the project's `work` folder for intermediate data:

```powershell
node scripts/anatomy/bootstrap.mjs ../../work/anatomy-source.json
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --factory-startup --threads 8 --python scripts/anatomy/refine_blender.py -- ../../work/anatomy-source.json .
node scripts/anatomy/verify.mjs
```

`bootstrap.mjs` imports the procedural generator directly, not the runtime asset cache. `refine_blender.py` uses `sculpt_teeth.py` and writes the .blend, GLB, sidecar and both inspection renders. It preserves the coordinate frame and bracket metadata and fails if any protected bracket surface loses its acceptable offset. `verify.mjs` parses the exported GLB using the application's Three.js loader before checking the geometry. `check-reference.mjs` checks candidate display registrations without altering files. No network access, external model download or API key is needed.

## Verified properties

All 58 meshes are closed indexed surfaces with finite vertices/normals and outward winding. All 28 root meshes are single connected surfaces while their explicit branch counts remain one, two or three. The original tooth pivots, axes and bracket anchors are unchanged. Crown bounding-box corner changes are below 0.282 mm; root changes are below 1.129 mm from the intentional root/trunk refinement. Bracket-anchor clearance is 0.2195–0.2218 mm.

The verifier constructs all 28 brackets and attachments, nine workflow appliance states, 28 removable-retainer crown envelopes and six representative anatomy cutaways. Tests additionally check every tooth's connected-root cutaway and exported posterior landmarks by ray intersection. The reference registration is now upper −1.5 mm and lower +1.5 mm along Y, with zero detected crown or root surface intersections. The full case-path audit was regenerated against this exact GLB and metadata. These are geometry checks, not clinical clearance or biological validation.

## Anatomy references and provenance

Original geometry was authored in this project; no external mesh, scan, illustration or texture was imported. Landmark references include the University of Al Maarif's [maxillary molar lecture](https://uoa.edu.iq/storage/uploads/6977312bc82b7_dental-anatomy-lec-11.pdf) and [mandibular second-molar lecture](https://uoa.edu.iq/storage/uploads/6977312f88547_dental-anatomy-lec-14.pdf). Root-count variation is documented by [Olczak, Pawlicka and Szymański](https://pubmed.ncbi.nlm.nih.gov/34714481/); the asset depicts selected teaching forms, not a claim that every tooth has this root pattern. These are references for anatomical facts, not licences to copy their figures. Educator review of the delivered morphology is still pending.
