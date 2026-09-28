# Claude dentition atlas snapshot

Imported on 2026-09-28 from the user-authorized local Claude output `scratch-2026-09-26-716563/out/`.
The producer workspace remains independent and was not modified or rebuilt by Forma.

| Bundled file | Producer file | SHA256 |
| --- | --- | --- |
| `public/models/forma-atlas-v1.glb` | `teeth.glb` | `6ef4321a6a642404fabdb1660e770d4fbc225c84296c73d22a8fcd9c4c182c86` |
| `public/models/forma-atlas-v1.json` | `teeth-meta.json` | `e6c018a51b783df326d7681975a085056e0a4cc1f531a5f97b10bdab63806fc0` |

Both files are byte-for-byte snapshots. Source hashes were checked before and after copying.
The metadata path disables Git line-ending conversion so its recorded checksum survives cloning.
Metadata generation time: `2026-09-28T10:33:18`. Raw GLB size: 19,295,644 bytes.
Source export: 32 teeth, two gingival meshes, 66 tissue primitives, 281,929 exported vertices,
509,774 triangles. The source export report listed no export problems. These are export checks,
not clinical validation or a statement that all authored movement paths are collision-free.

The producer's `build/notes/integration.md` records a complete shared build using all 16 tooth-class
refiners, replacing the previous shared baseline premolars and older lower molars. All tooth poses and
frames, both gingival surfaces, and the baked material channels were rebuilt together. Forma's regenerated
audit still finds zero crown/root intersections in the reference arrangement; authored movement-path
crossings remain reported without relaxed checks.

The later `build/notes/look.md` work is explicitly sandbox-only: transferred dense-surface gum shading
normals, reduced mucosal gloss, warmer incisor bands, softened narrow-groove AO and teeth-only Cycles rim
light are not part of this snapshot. Newer source web AO/sheen/shadow treatment, jaw framing and label
decluttering are likewise not ported by this asset refresh. Producer review and QA notes are provenance,
not a substitute for Forma's own checks or a claim of clinical review.

### Snapshot history

Phase 3.21 used generation `2026-09-28T05:29:16`: 19,205,456-byte GLB, 280,374 vertices / 508,220 triangles.
Its GLB SHA256 was `a9feeadedfeb8debf33b3523cff9a4fc3cd98456c5bc8763fca3ed0f6dc14183`; metadata SHA256 was
`a1e30b99bd6e0d597e37fd08c1c92ee090475c5c1544ac36a872153d323d2414`. Git retains that complete paired snapshot.

## Runtime mapping

`src/lib/atlas-assets.ts` uses the 28 FDI teeth ending in 1–7 for the existing teaching cases.
The unmodified bundled source still contains all 32 teeth; wisdom teeth are not presented or selectable
in this integration. Both source gingival meshes are retained.

Coordinates remain millimetres: +X patient left, +Y superior, +Z anterior. Each source `tooth_<FDI>`
contains enamel and cementum primitives. The adapter converts those world vertices to a shared crown-centre
pivot, with no change to their world placement, and uses the supplied mesial/buccal directions and negative
apical axis for Forma's occlusal direction. Buccal bracket points are measured on the actual crown surface.
The producer's fitted occlusion needs no legacy upper/lower reference correction.

Preserved channels: position, smooth normal, albedo `color`, normalized `color_1` (near AO, thickness,
crown-height/gum-zone parameter, far AO), and UV. `dentalData` aliases `color_1` for the source material port.
Case JSON stores decoded color/data/UV values and reconstructs the aliases on load.

The producer does not supply Forma's branch-wise `rootAnatomy` profiles. The adapter does not fabricate
them or transfer profiles from the old model. Physical root surfaces and movement trails remain available;
any derived teaching anatomy must respect that capability boundary.

Gingival following is a Forma display adaptation. Nearby authored tooth-surface vertices supply cached
blend weights; each frame uses absolute displayed tooth poses, while the arch base and palate taper to
fixed tissue. Only viewer-owned position/normal buffers change. Authored smooth-normal detail rotates with
the changed local triangle surface; albedo/data/UV channels and source geometry stay unchanged. Returning
to the rest pose restores the original positions and normals exactly. Lower-jaw display separation is
applied once. This qualitative deformation does not calculate soft-tissue biology, prevent large-movement
folds, or alter exported source gingiva, collision checks, solver results or clinical claims.

### Precomputed gingival bindings

`public/models/forma-atlas-gums-v1.bin` is a Forma-generated version-1 sidecar, not a producer file.
It contains the exact display weights for both 14-tooth arches and the upper 12-tooth extraction-lecture
subset. Size: 3,268,315 bytes. SHA256:
`62bc9d4bec01b320134250ab3afe2366116e213f1d254b481ac94fe95a45fcaa`.

Phase 3.24 updated only the generator-input fingerprint after rewording a loader recovery message
for the Nael Teaching Studio name. The complete numeric binding payload and other header fields
are byte-for-byte unchanged from 3.22; the earlier complete-file hash was
`43e71b6e2e844ab7323339fc57ea90db9b7be932460247507d5f218fdc142300`.

Regenerate it with `node --experimental-strip-types scripts/generate-atlas-gum-bindings.mjs` after
formatting changes to any input listed by `GUM_BINDING_INPUTS`, or after replacing either source asset.
The generator uses the runtime adapter and influence algorithm. Its header records source, payload and
generator-input SHA256 hashes; tests compare these and freshly calculated weights. Runtime validation
checks exact model descriptors, byte-length/FNV corruption checks, influence indices and bounded weights
before publishing the loaded model. This is a staleness/corruption check, not an authenticity guarantee;
it works on ordinary LAN HTTP without requiring WebCrypto. The static-demo check requires the sidecar.

The shipped model therefore avoids synchronous nearest-surface searches when the viewer mounts.
Class I/II/III rigid arch shifts reuse the same bindings, with relative-origin keys rounded at 1e-8 mm.
Saved unmodified surfaces can reuse canonical bindings after comparing actual position/tissue data;
arbitrary geometry or altered relative tooth baselines use the bounded four-entry fallback cache.
An uncached changed model can still require several seconds of synchronous influence calculation.

One in-memory CPU run measured 85.4 ms to validate/prime the shipped bindings and 71.9 ms to prepare both
gum followers, compared with approximately 4.4 seconds for the previous cold calculation. A second viewer
took 61.5 ms; a single moving-incisor sequence took 3.1 ms median / 3.9 ms p95 per changing frame, with
21.7 ms for its first changed frame. Hidden and unchanged gum frames skip deformation. These fixture
measurements exclude downloading, GLTF parsing and GPU rendering and are not a browser FPS guarantee.

The current reference and movement evidence is generated from this snapshot by
`node --experimental-strip-types scripts/audit-teaching-cases.mjs` and stored in
`src/lib/teaching-case-audit.json`. New snapshots require rerunning that audit and the asset contract tests.

## Updating the snapshot

Wait for a coherent producer export. Copy its matching raw `teeth.glb` and `teeth-meta.json` files to the
bundled paths above, verifying that neither source changes during the copy. Record new hashes here and
rerun the adapter tests and teaching-case audit. Do not substitute the packed file: its integer positions
require an explicit Float32 dequantization step before applying world transforms.

The older `forma-teaching-v1` asset and adapter remain available for legacy regression coverage.

## UI and material adaptation

Claude's `web/src/styles.css` and `web/src/app/` material/stage modules supplied the visual reference:
warm instrument panels, Instrument Serif and IBM Plex typography, camera rail, tooth inspector,
odontogram, enamel/cementum/gingiva shading and camera-relative lighting. Forma's implementation
connects that treatment to its existing teaching runtime; it does not embed the separate Atlas app.
Font files and their SIL licenses are recorded in `public/fonts/README.md`.

The material port targets the installed Three r186 shader chunks. Seeded microtextures use deterministic
texel sampling rather than Canvas antialiasing, and Forma retains its translucent gum controls.
Source-level compatibility tests do not establish pixel equivalence or GPU/browser acceptance.

## Tooth diagram

Phase 3.23 ports the producer's `web/src/app/ui.js` crown/root SVG formulas (`glyphPaths` and
`glyphSVG`), chart order and proportional two-row treatment from `web/src/styles.css`. Producer
workspace: `scratch-2026-09-26-716563`, read only on 2026-09-28. The full source UI file SHA256 is
`50765adb9e664d62329b125166785043ab28e77c8e2b3c9650596b21da66ca74`; the original glyph-function
substring SHA256 is `ef008631846d837772032965df6cfaf7b0c7558c298179236f630da7684bfe05`.

The port uses the existing bundled 10:33 metadata snapshot above, without replacing the 3D model.
Executing the original producer function with that metadata and source tooth classes produces the
canonical 32-entry `{id: {md, crown, roots}}` JSON SHA256
`34eb375035f2e868be7103a3dceb1613d2285b164d985727ba42e03cc6be5fc5`. The regression test compares
the port against that independently captured value; do not update it merely to bless a changed port.

Forma preserves its theme, current model's selectable teeth and existing interaction handlers.
Missing teeth retain empty proportional slots. The ordinary model remains 28 teeth; imported cases
with wisdom teeth can use all 32 diagram positions. SVG drawings are illustrative atlas symbols,
not projections of a patient's anatomy. Exact path-data parity does not establish rendered pixel
equivalence; browser and DPR acceptance remain pending.

## Jaw opening and selection glow

Phase 3.26 ports the producer's `web/src/app/model.js` hinge transform and
`web/src/app/materials.js` selection overlay from the same owner-authorized workspace,
read on 2026-09-28. Source SHA256 values:

- `model.js`: `37a977e4bcc3c70ab309b5abf5e3976ef0490d72f8fdbd6848db2f35dad7f3bf`.
- `materials.js`: `8ee4a1972d2fdeddbf807a75769788297a0a40e2feed713fbf2f7b136b712351`.

The bundled metadata supplies the hinge `[0, 39.2, -77.8]`, axis `[1, 0, 0]` and
14-degree open pose. Forma applies that rigid display transform to the lower teeth,
gingiva and attached overlays, then applies its existing independent vertical separation.
Canonical tooth poses, saved mechanics and tissue-deformation inputs remain unchanged.
The two closed/open poses are deterministic; the producer's 650 ms jaw tween is not ported.

The selection overlay retains the producer's Fresnel additive surface glow: color
`0x8fc3e0`, base `0.02`, rim `0.6`, front faces, depth test without depth writes,
polygon offset `(-1, -4)` and render order `10`. It leaves enamel materials intact,
has no raycast and hides with isolated teeth. It uses shared material resources and
existing geometry, with no bloom pass. Source and CPU tests do not establish visual
equivalence on a GPU; browser, theme/projector and DPR acceptance remain outstanding.

No model, metadata, gum-binding payload or teaching-case audit data changed in this port.
