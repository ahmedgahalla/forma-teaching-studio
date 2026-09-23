# Blender teaching anatomy

This is an original, editable teaching asset generated from Forma's procedural anatomy and refined in **Blender 5.1.1**. It contains no patient scan or third-party mesh. Crown classes, root branches and supporting gingiva are schematic, not a reconstruction or a clinical model.

## Deliverables

| File | Purpose |
| --- | --- |
| `forma-teaching-v1.blend` | Editable Blender source containing the 58 runtime objects. |
| `forma-teaching-contact-sheet.png` | Blender render of linked copies of the delivered surfaces: complete dentition, upper/lower occlusal views, and representative crown/root forms. |
| `../../public/models/forma-teaching-v1.glb` | Browser asset with 28 separate crowns, 28 root meshes and two gingival meshes. About 2.99 MB. |
| `../../public/models/forma-teaching-v1.json` | Original tooth pivots, anatomical frames, bracket anchors, mesh names and asset manifest. |
| `verification.json` | Checks run against the exported GLB through Three.js, including topology, registration and appliance compatibility. |

The .blend is saved before the temporary contact-sheet layout is built. The presentation duplicates are not part of the runtime file. The application supplies its own display materials; the source also includes neutral enamel, dentine and gingiva materials for authoring and inspection.

## Refinement and mesh budget

The Blender script sculpts anterior labial lobes, lingual fossae and cingula in calibrated tooth coordinates, rounds distal incisal corners, and refines posterior fissures and fossae. A protected labial patch keeps the original bracket registration. Root branches retain their cervical junctions and gain a fuller middle/apical profile and consistent distal sweep. Alternating fairing reduces triangulation ripple; adaptive decimation removes redundant triangles without a blanket subdivision pass.

| Part | Triangles |
| --- | ---: |
| 28 crowns | 98,616 |
| 28 root objects | 40,832 |
| Two gingival meshes | 23,596 |
| **Total** | **163,044** |

The original input contains 406,304 triangles. The delivered asset uses about 60% fewer triangles. Multi-root teeth remain separate connected branches within their named root object so the existing schematic socket/ligament generator can follow them.

## Runtime coordinate contract

- Metadata version: `1`; units: `mm`.
- World coordinates: **+X patient left, +Y superior, +Z anterior**.
- GLB numeric coordinates are deliberately millimetres for the application's case convention. Do **not** multiply by 1,000 based on glTF's usual metre convention.
- Nodes are `crown_11`, `root_11`, and so on for the 28 permanent teeth excluding third molars, plus `gum_upper` and `gum_lower`.
- Clone each loaded mesh geometry, apply its complete `matrixWorld`, then subtract the metadata tooth `position`. Use the same original pivot for its crown and root. Do not recenter either mesh by its refined bounding box.
- Gingiva uses position `[0, 0, 0]`. Keep tooth `buccal`, `mesial`, `occlusal`, `bracketPosition` and `calibrated` metadata unchanged.
- Blender authoring is Z-up: case `(x,y,z)` is stored as `(x,-z,y)`. The Y-up GLB export reverses this conversion; the verification script checks the result.

## Rebuild

Run from the `dental-studio` folder with Node 24 and Blender 5.1 installed. The paths below are an example using the project's `work` folder for intermediate data:

```powershell
node scripts/anatomy/bootstrap.mjs ../../work/anatomy-source.json
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --factory-startup --threads 8 --python scripts/anatomy/refine_blender.py -- ../../work/anatomy-source.json .
node scripts/anatomy/verify.mjs
```

`bootstrap.mjs` imports the procedural generator directly, not the runtime asset cache. `refine_blender.py` writes the .blend, GLB, sidecar and contact sheet. It preserves the coordinate frame and bracket metadata and fails if any protected bracket surface loses its acceptable offset. `verify.mjs` parses the exported GLB using the application's Three.js loader before checking the geometry. No network access, external model download or API key is needed.

## Verified properties

All 58 meshes are closed indexed surfaces with finite vertices/normals and outward winding. The original tooth pivots, axes and bracket anchors are unchanged. Crown bounding-box corner changes are below 0.079 mm; root changes are below 0.893 mm from the intentional root refinement. Bracket-anchor clearance is 0.214–0.223 mm.

The verifier constructs all 28 brackets and attachments, nine workflow appliance states, 28 removable-retainer crown envelopes and six representative anatomy cutaways. It detects zero crown-triangle intersections in both the original pose and the reference bite with upper teeth shifted −1.6 mm and lower teeth +1.6 mm along Y. These are geometry checks, not clinical clearance or biological validation.
