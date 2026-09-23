# The delivered Blender model

Forma now loads an actual Blender-refined GLB into the interactive workspace. The model is original schematic teaching anatomy: 28 separate crowns, 28 separate root objects and two gingival meshes. It is not a patient scan, segmentation result or clinical reconstruction.

The Blender pass refines anterior labial/lingual forms, incisal corners, posterior fissures and fossae, and curved root taper. Surface fairing and decimation reduce the original 406,304 triangles to **163,044** while retaining the tooth frames and bracket anchors used by commands and appliances.

| Deliverable | Location |
| --- | --- |
| Editable Blender 5.1 source | [forma-teaching-v1.blend](../assets/anatomy/forma-teaching-v1.blend) |
| Rendered contact sheet | [forma-teaching-contact-sheet.png](../assets/anatomy/forma-teaching-contact-sheet.png) |
| Browser model, about 2.99 MB | [forma-teaching-v1.glb](../public/models/forma-teaching-v1.glb) |
| Mesh names, tooth frames and manifest | [forma-teaching-v1.json](../public/models/forma-teaching-v1.json) |
| Geometry verification report | [verification.json](../assets/anatomy/verification.json) |

The application loads the GLB and metadata before mounting the case and workflow viewers. If loading fails, **Retry model** retries the asset; **Open basic model** explicitly uses the procedural fallback. A notice identifies that fallback. Previously saved cases keep their saved meshes rather than being silently replaced by the new asset.

## Coordinates and editing

The app's case frame is **+X patient left, +Y superior, +Z anterior**, in millimetres. GLB numeric coordinates deliberately follow that existing millimetre convention; do not apply the usual glTF metre-to-millimetre scale conversion.

Mesh names are `crown_11`, `root_11`, and the corresponding FDI names for the other teeth, plus `gum_upper` and `gum_lower`. The loader applies each node's world matrix, then subtracts the supplied tooth pivot. Crown and root share that original pivot. The axes and bracket anchor must remain paired with the geometry; independently recentering a root or crown breaks registration.

The .blend uses Blender's Z-up authoring frame, mapping case `(x,y,z)` to `(x,-z,y)`. Export returns it to the application's Y-up frame. Prepared cases additionally register the upper and lower tooth/gum origins 1.6 mm toward the occlusal plane; this is authored case registration, not reconstructed patient occlusion.

## Rebuild

From the `dental-studio` folder, with Node 24 and Blender 5.1 installed:

```powershell
node scripts/anatomy/bootstrap.mjs ../../work/anatomy-source.json
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --factory-startup --threads 8 --python scripts/anatomy/refine_blender.py -- ../../work/anatomy-source.json .
node scripts/anatomy/verify.mjs
```

Adjust the Blender executable path for your installation. The pipeline generates the editable source, runtime GLB, metadata and contact sheet without downloading models. The verifier uses Three.js to reload the actual GLB and checks closed surfaces, finite data, original frames, bracket/attachment placement, appliance overlays and representative anatomy cutaways. Detailed counts and the coordinate contract are in the [asset README](../assets/anatomy/README.md).

## Limits

Blender is an authoring tool here; users do not need it installed to run the delivered app. The runtime viewer supplies its own materials and lighting, so the contact sheet is an inspection render, not a screenshot of the browser.

The model omits third molars and does not reconstruct patient roots, bone or periodontal tissue. Supporting tissues and removable-retainer surfaces are generated display illustrations. Closed meshes and successful geometry tests do not establish anatomical accuracy, biological feasibility, retainer fit or manufacturing readiness. Case-specific descriptions and numerical scenarios remain source-linked drafts pending educator review; see [Teaching cases](TEACHING_CASES.md).
