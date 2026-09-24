# v0.12 acceptance checklist

Prepared 24 September 2026. This matrix records the latest completed automated pass and keeps final release acceptance explicit. Subsequent implementation changes require the relevant checks to be repeated. A code test, rendered contact sheet and real classroom/device check are different evidence.

## Acceptance matrix

| Area | Status | Evidence / remaining acceptance |
| --- | --- | --- |
| Complete frontend regression | **Passed** | `npm test`: **1,459 tests in 46 files**, zero failures; 25.62 s. Run began 24 September, 05:25:09 UTC. Includes geometry, rendering helpers, commands, persistence, mechanics, speech integration and prior workflows. |
| Backend contracts and provider-error handling | **Passed, mocked providers** | Final release-owner run: **335 tests in 3 files**, zero failures. One existing Starlette/AnyIO `BlockingPortal` deprecation warning. No live provider claim. |
| Persistent speech controller | **Passed with fake recognition** | Eight ReactDOM/jsdom integration tests: hold/release, interim text, duplicate final once, pointing without abort, Escape/focus-loss discard, manual interaction cancellation, narration interruption, async adapter completion visible to narration/snapshot/Undo/Redo, typing/rerender persistence. No real microphone used. |
| Permanent anatomy runtime asset | **Passed, geometry checks** | Actual GLB reload; 28 crowns, 28 connected root objects, 2 gums; **211,452 triangles**. Frames, bracket anchors, closed surfaces, root metadata, cutaway registration and appliance compatibility checked. See [asset report](../assets/anatomy/verification.json). |
| Anatomy inspection renders | **Fresh for this asset** | Contact sheet 04:28:08 UTC and fourteen-class render 04:28:32 UTC follow the GLB/sidecar export at 04:27:39 UTC. Both were visually inspected. They are Blender inspection renders, not browser screenshots. |
| Dental Class I / II-1 / II-2 / III | **Passed, synthetic geometry** | Eight arrangement tests. All four shipped starting poses have zero detected crown/root triangle-surface crossings. An injected-overlap test confirms crossings are reported. Incisor orientation/projection, arch registration and immutable source geometry checked. Not validated clinical occlusion or skeletal diagnosis. |
| Initial elastic mechanics | **Automated coverage passed** | Shared bounded engine tests cover support/beam calculations, force/moment and equilibrium behavior, wire section/slot/strain checks, TAD alternatives, actuator compliance, fixed reference/stages and stale/invalid results. Final three-family browser acceptance below remains separate. |
| Saved cases and compatibility | **Automated coverage passed** | Version-3 optional root metadata, mechanics inputs and lecture setup; invalid input rejection; prior version-1/version-2 loading. A loaded dental arrangement retains its own original poses for reset, comparison and playback, with a zero-pose default for legacy Try sessions. Saved mechanics results are not trusted and must be recalculated. A browser v3 download/reopen recalculated the same 0.0116 mm / 0.076° wire result and restored roots, front camera, selection and 50% stage. |
| Final strict TypeScript and optimized export | **Passed** | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: exit 0, 21.14 s; the release owner also typechecked the later isolated JSX fix. Optimized v0.12.0 exports passed at 05:30 UTC and after final display-only fixes at 05:38 UTC, reported by the release owner. The latter export is packaged and HTTP-verified below. |
| Final connected-browser interactions | **Passed for typed/pointer interaction** | All three appliance families operated together; marker-based TAD placement, passive-wire clarification, replacement, comparison without TAD, Stop, Undo/Redo, prediction/reveal, scale label, Class II division 2 and whole-case restoration were exercised. Camera → roots → halfway executes in order. Pointing during actual microphone capture remains a human check. See [verification](VERIFICATION.md). |
| Current desktop/mobile layout | **Passed, browser viewport check** | Clinical/Midnight at 1280×720 and 390×844. Phone command/microphone/Stop remain reachable; inspector resizes the model above its sheet; tools no longer cover posterior teeth. No application exception captured; earlier GPU shader precision warnings were observed. Actual touch and projector-distance readability remain human checks. |
| Real microphone / browser speech | **Pending human/device check** | Chrome/Edge permission, actual recognition, hold/release behavior, pointing during capture and interruption on the intended classroom machine. |
| Live OpenAI/OpenRouter | **Passed with OpenRouter** | Real backend requests and a UI fallback request returned valid actions. Flexible gingiva/root wording changed both layers; connection persisted after reload. A provider numeric mismatch was rejected by independent validation. The direct OpenAI route was covered by mocks, not a live OpenAI key. |
| Faculty / anatomical / curriculum review | **Pending educator review** | Review landmarks/root variants, approximate molar guides, supporting-tissue illustration, mechanics assumptions and explanatory text before curriculum use. No faculty approval, clinical validation or learning-outcome claim. |
| Final ZIP and extracted launch | **Passed** | The final 234-file v0.12.0 ZIP passed CRC, version, artifact exclusions and byte parity with all packaged source/export files, including the final display rebuild. A clean extraction launched with `node scripts/serve.mjs` on `127.0.0.1:3002`; 13 page/model/metadata/worker/asset requests returned HTTP 200 with exact file bytes and correct GLB/worker content types. Only that verification process was stopped; port 3002 is closed. |
| Hosted phone site | **Not updated by this checklist** | Local builds and ZIPs do not publish the private site. Consult [mobile status](MOBILE_TEST.md). |

## Exact anatomy revision

Morphology revision: `permanent-landmarks-2`; existing `v1` filenames preserve the loader contract.

| File | SHA-256 |
| --- | --- |
| `public/models/forma-teaching-v1.glb` | `b9f009f0dea3e019de180f8b41ab8a5be9a514b851bb969f36da6b700ab02d27` |
| `public/models/forma-teaching-v1.json` | `12dd26123641fca14dd6c0331fe08e17fc1f37b5fc8c63d3a5da743033ee5afd` |

These checks establish file identity and geometric invariants, not clinical accuracy. The pack is original permanent teaching anatomy with no third molars; primary/mixed-dentition models are not included.

## Reproduce automated checks

From the application folder:

```powershell
npm test
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
```

The `prebuild` hook bundles the shared mechanics engine into `public/workers/mechanics.js` before Next exports the app. `predev` does the same for development. Confirm `out/workers/mechanics.js` is present after the final build. Backend setup and its isolated `python -m pytest -q` command are in [backend/README.md](../backend/README.md); tests do not need a provider key.

## Packaging review and command

The local helper `../../work/package_app.py` packages an explicit set of application root files plus `src`, `backend`, `scripts`, `sample-models`, `docs`, `public`, `assets` and the final `out`. It includes `vitest.config.mts`, the editable Blender source, runtime anatomy and worker. It excludes dependency/build caches, runtime logs, `.blend1` backups, common temporary artifacts, and every `.env*` file except the empty-key `.env.example` template. The helper has a workspace-specific source/output path and overwrites `outputs/Forma-Dental-Studio.zip` when run; it does not deploy a site.

Recommended command **after the release owner completes the final build**, from `dental-studio`:

```powershell
& 'C:\Program Files\Python310\python.exe' ..\..\work\package_app.py
```

Packaging and an extracted HTTP launch of the final display rebuild were verified on 24 September 2026. The workspace audit is `work/forma-release-check-012/release-audit.json`; the final clean extraction is under `work/forma-release-check-012/final/dental-studio`. No configured environment, runtime log, backup or temporary artifact was included. The ZIP was refreshed with these completed acceptance notes, with unchanged HTTP-verified runtime bytes. Any later export or documentation change requires a fresh archive and parity check.
