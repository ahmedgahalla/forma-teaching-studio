# Claude dentition atlas snapshot

Imported on 2026-09-28 from the user-authorized local Claude output `scratch-2026-09-26-716563/out/`.
The producer workspace remains independent and was not modified or rebuilt by Forma.

| Bundled file | Producer file | SHA256 |
| --- | --- | --- |
| `public/models/forma-atlas-v1.glb` | `teeth.glb` | `a9feeadedfeb8debf33b3523cff9a4fc3cd98456c5bc8763fca3ed0f6dc14183` |
| `public/models/forma-atlas-v1.json` | `teeth-meta.json` | `a1e30b99bd6e0d597e37fd08c1c92ee090475c5c1544ac36a872153d323d2414` |

Both files are byte-for-byte snapshots. Source hashes were checked before and after copying.
The metadata path disables Git line-ending conversion so its recorded checksum survives cloning.
Metadata generation time: `2026-09-28T05:29:16`. Raw GLB size: 19,205,456 bytes.
Source export: 32 teeth, two gingival meshes, 66 tissue primitives, 280,374 exported vertices,
508,220 triangles. The source export report listed no export problems. These are export checks,
not clinical validation or a statement that all authored movement paths are collision-free.

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
