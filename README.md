# Forma Teaching Studio · v0.11

A local 3D dental workspace for teaching, lectures, and geometric demonstrations. The **Workflow Classroom** explains fixed braces, palatal expansion, archwire expansion, and tooth anatomy. One shared command bar accepts typed requests or **hold-to-talk** speech across the case and classroom. Combine up to eight supported actions, explore a temporary variation of a lesson, undo the request, or return to its authored setup. Next.js and React provide the workspace, Three.js renders the meshes, and an optional Python/FastAPI service uses OpenAI for flexible wording. Familiar commands run locally without an API key.

Start with the [combined workspace guide](docs/COMBINED_WORKSPACE.md) to move between prepared lessons and free experiments, the [Try Mode guide](docs/TRY_MODE.md) for the default editing workspace, and the [Voice Classroom guide](docs/VOICE_CLASSROOM.md) for microphone controls, anatomy layers and lesson commands.

## Interactive university lectures

Version 0.11 improves anatomy contrast, keeps selected teeth in natural enamel with a thin contour, fits the whole selected group, adds a left camera view, and lets you isolate the selection. **Lecture mode** now places professor controls beside the model on wide screens: playback, direct progress seeking, speed, question/reveal, original overlay and anatomy visibility. A screen pointer directs attention without selecting or moving teeth. The same controls work in appliance and anatomy workflows.

Read the [Professor guide](docs/PROFESSOR_GUIDE.md). The product is a teaching sandbox with optional authored demonstrations. The case library still requires orthodontic educator review.

## Midnight Lab and Clinical Studio

Version 0.10 adds a dark Midnight Lab interface, a persistent bright Clinical Studio theme, a compact desktop tool rail, mobile sheets, and a preview decision bar that remains visible with Tools closed. Read the [UI guide](docs/UI_GUIDE.md). The appearance settings preserve model positions, camera state and existing editing mechanics.

## Blender anatomy, prepared cases and a mobile workspace

Version 0.9 loads a refined 28-tooth synthetic model exported from Blender, with individually linked crowns and roots. The editable `.blend` and a contact sheet are included in `assets/anatomy`; no Blender installation is needed to run the browser app.

The Teaching library now contains **12 cases and 19 authored demonstrations**, including crowding, diastema, crossbite, open/deep bite, anchorage comparisons, finishing and removable retention. Choose an approach, ask its prediction question, play or scrub the sequence, and reveal the explanation. **Explore this arrangement** freezes the shown stage for free edits; **Return to prepared case** restores that stage. Alternative demonstrations share their own prepared baseline. These are draft teaching examples awaiting educator review, not treatment plans.

On phones, the bottom **Model / Select / Layers / Tools / Stop** dock gives access to controls without stacking them over the model. Case playback and Explore remain beside the model. Use text commands or the hold-to-talk microphone where supported. Voice recognition and rendered mobile interaction still need a device check.

Read the [case and command guide](docs/CASE_WORKSPACE.md), [Blender model guide](docs/BLENDER_MODEL.md), and [verification record](docs/VERIFICATION.md). The packaged local build contains v0.11. See [mobile publication status](docs/MOBILE_TEST.md) before using the phone link; a local build does not by itself update the hosted site.

## Connect a lesson to a free experiment

Version 0.8 brings the teaching library and Try Mode together. Pause a prepared workflow and choose **Try this setup** to copy its displayed tooth arrangement, attachments, anatomy settings and camera into the editing workspace. The lesson card keeps its explanation, question and sources close by. **Return to source lesson** restores that classroom setup; **Restore my workspace** brings back the original case and edits. Both returns and the transfer support whole-request undo/redo.

The **Appliances** tab now offers brackets only, brackets and wire, molar bands, a palatal expander and a lingual retainer. Hardware follows the edited teeth. Expander opening and optional schematic palate halves change the illustration only. These settings are saved with the case; the source link and previous-workspace backup last for this session only. No Blender installation is required.

```text
start palatal expansion workflow
show movement
pause demonstration
try this setup
place brackets only
return to source lesson
restore my workspace
```

Run each line separately. **Try this setup** copies the shown arrangement, not the source lesson's movement path. It preserves the source lesson for replay and comparison. See [COMBINED_WORKSPACE.md](docs/COMBINED_WORKSPACE.md) for exact return behavior and file contents.

## Try an arrangement before applying it

Version 0.7 opens the case in **Try Mode**. Select teeth, preview a per-tooth movement or rigid segment, review the proposed endpoint and sampled path, then **Apply** or **Discard**. The guided Workflow Classroom remains available beside this free teaching workspace.

```text
select upper front six
lock upper molars
move the selected segment posteriorly 0.5 mm
apply preview
show after
save arrangement as baseline
```

Run these as separate requests and review the preview before Apply. Constrained Apply blocks detected new crown crossings or an exhausted sampling budget. Explicit **Unrestricted illustration** permits intersecting teaching geometry while retaining tooth locks. An intersection-free sample report does not establish clearance or biological feasibility.

New tools include a shared-centre segment rotation, projected gap closure with an explicit equal/first/second rule, symmetric pair-centre span changes, a reference arch ellipse for calibrated synthetic teeth, saved arrangements and selection groups, displacement traces, reverse playback and replacement of the last numeric amount. `compare with original` shows an overlay; `compare saved arrangement baseline` overlays that saved setup. Neither commits a restoration. `undo the last two changes` restores two whole recorded requests, provided enough history exists.

New Try mechanics are **local-only English commands**. The optional AI endpoint can still interpret unfamiliar earlier classroom wording, including camera and visibility requests. Ordinary tooth commands also create previews while Try Mode is active. Resolve the preview before another edit or saving/exporting. Timeline scrubbing changes the shown frame; the applied endpoint remains committed. Say `show after` before a new edit, and `return to try mode` as a separate request when returning from a classroom. See [TRY_MODE.md](docs/TRY_MODE.md) for exact commands, software bounds, persistence and collision limitations.

Version 0.6 improves the synthetic model with smooth, differentiated crowns, curved roots, scalloped gingival bases and clearer tooth-and-socket sections. Enamel and gingiva use subtle colour gradients under studio lighting; brackets, wires and expanders have refined metal finishes. The initial-position overlay is a translucent surface. These are authored teaching models, not patient reconstructions. Display shading leaves stored and exported source geometry unchanged; older saved cases keep their own meshes. No Blender installation is required.

## Open the application

On Windows, double-click **START.cmd** in this folder. It serves the included production build and opens **http://127.0.0.1:3000**. Node.js 22 or newer must be installed. Keep the terminal running while using the app.

From a terminal, on any operating system:

```sh
npm ci
npm run build
npm start
```

For development use `npm run dev`. The default host is loopback only. If port 3000 is occupied, stop the previous local instance or set `PORT` for `npm start`. The prebuilt `out/` folder is a static export. The optional Python service runs separately.

## Test from a phone on any network

Open [Forma mobile](https://forma-teaching-mobile.ahmedgah123.chatgpt.site). The deployment is private to the owner; sign in with the same ChatGPT account if prompted. See [mobile test instructions](docs/MOBILE_TEST.md).

## Test from a phone on the same Wi-Fi

The default server stays on the computer only. To bind a separate test server to the computer's Wi-Fi IPv4 address, run in PowerShell (replace the example address with the current address shown by `ipconfig`):

```powershell
$env:FORMA_HOST = '192.168.1.65'
$env:PORT = '3001'
npm start
```

Open `http://192.168.1.65:3001/` on a phone on the same Wi-Fi. Network isolation or the Windows firewall may prevent access. Start with typed commands; microphone behavior must be checked on the device. This LAN address is not an internet link and does not work from a different network. Stop the test server with Ctrl+C. The default launch remains loopback-only.

## Open the Workflow Classroom

Choose **Teaching library** in the case header, then select a seven-step appliance demonstration or the four-step anatomy lesson. Each classroom opens a fresh synthetic model. Your case, edits and camera remain available through **Back to my case**; the case viewer pauses while the classroom is open.

| Workflow | What it demonstrates | Main distinction |
| --- | --- | --- |
| Fixed braces | Assessment, bracket-only installation, archwire and ties, direction arrows, scripted alignment, endpoint review and retention | Bracket placement alone does not move the teeth. The wire and later movement are separate explanatory stages. |
| Tooth-borne palatal expansion | Posterior bands, palatal framework and central screw, transverse arrows, an idealized widening example, passive stabilization and review | The split palate is conceptual, not reconstructed anatomy or predicted sutural opening. Real skeletal and dental contributions vary. |
| Dental archwire expansion | Brackets, engaged archwire, intended directions, illustrative dental translation and inclination, review and retention | This is a dental arch-form example, with no split palate or claim of predictable skeletal expansion. |

Use **Next step**, **Previous step**, the numbered step buttons, or the left/right arrow keys. The explanation panel describes what is done, why it matters and what to observe, followed by a classroom question with a revealable answer. Each workflow includes source links and teaching limits. Camera presets, tooth highlighting, roots, gingiva, tooth numbers and direction arrows help focus the discussion.

Installation steps immediately show the selected appliance components; they are not procedural placement animations. **Play demonstration** opens the movement step. Pause, scrub from **0–100%**, or adjust playback speed to explain it at your own pace. Progress and speed describe an authored animation, not clinical time, screw turns or a force magnitude. Retention steps hold the endpoint without continued widening.

Type a request, or hold Space outside an input, speak, and release to run it. Short commands include:

```text
start braces workflow
start palatal expansion workflow
start archwire expansion workflow
install brackets
insert archwire
install expander
activate expander
show forces
show movement
play demonstration
pause demonstration
show retention
next step
previous step
restart workflow
exit workflow
```

Choose the relevant workflow before using its appliance commands. `activate expander` shows the loading-concept step; it does not prescribe or perform a clinical activation. You can also say `demonstrate palatal expansion slowly` to open and play that example at half speed.

During a workflow, an explicit request such as `move 11 buccally 0.5 mm` creates a **temporary variation of the currently displayed step**. Adding or removing attachments can also create a reversible variation. The workflow remains open. Say `return to the lesson` to restore the authored frame, or move to the next step to resume its canonical story. Say `undo that` to restore the whole prior command request. Measurements, ordinary timeline stages and case exports remain in the case workspace. Classroom progress and variations are not saved into the case file.

See [Treatment workflows and supporting research](docs/TREATMENT_WORKFLOWS.md) for the source-grounded outlines, discussion questions, maturation and retention considerations, and the distinction between tissue remodelling and mesh animation.

## Look inside the synthetic tooth

Choose **Inside a tooth: translation and tipping**, or say `start anatomy lesson`. Its four steps introduce the tooth and supporting tissues, demonstrate translation, demonstrate tipping, and compare the two movements. `demonstrate translation` and `demonstrate tipping` open and play the corresponding examples. `compare translation and tipping` plays translation followed by tipping, waiting for each animation in order.

Use `show roots`, `show bone`, `show cutaway`, and `show periodontal ligament`. `make the bone transparent` selects the 25% opacity display preset; `make the bone opaque` restores full opacity. For a precise display value, use `set bone opacity to 40 percent`.

The support tissues are **schematic, stationary teaching references** while the tooth moves. The ligament is enlarged for visibility. These are not reconstructed patient anatomy, deforming tissues, force calculations or biological predictions. The new bone, cutaway and ligament display is available only with synthetic teaching models; an imported STL does not acquire invented supporting tissues. Starting an anatomy lesson opens a fresh synthetic example.

## Explore the case workspace

In v0.7, the movement instructions below create previews in the default Try Mode; use Apply or Discard. `leave try mode` returns to the earlier direct-edit workspace once any preview is resolved. The ordinary checkpoint sequence remains separate from the current Try edit's playback path.

1. The synthetic **28-tooth upper and lower dentition** loads with brackets and archwires. The demo omits third molars; the editor accepts all 32 permanent FDI IDs when supplied.
2. Click a crown or tooth number. Shift-click to build a selection, or use the arch/group controls. Commands can also name groups directly.
3. Use the move or rotate handles to drag the active tooth directly, or enter `intrude upper incisors 0.5 mm` followed by `torque upper incisors -3 degrees`. Handles use world axes for one tooth; named commands use each tooth's stored anatomical reference axes and support groups.
4. Open **Lessons** and choose a guided demonstration. Use next/previous step, or say `next step`, to explain translation, tip and torque; upper/lower intrusion; group expansion; or appliances and before/after comparison. Lessons operate on the current case and may reset its tooth positions. Save a setup you want to retain first.
5. Use **Before**, **After**, or **Overlay** to compare positions. Switch to **Lecture mode** for a presentation layout; camera, arch and visibility controls help isolate the point you are explaining.
6. Show brackets, wires, schematic roots, or gingiva. Adjust bracket appearance and ligature colour, or separate the arches for inspection. Display separation does not alter movements, exported geometry, or measurements.
7. Add rectangular, ellipsoid, or beveled attachments to selected calibrated teeth. Edit dimensions, mesial/occlusal offsets and rotation, then apply. Attachments follow their crowns; use Remove to reverse an attachment edit. Command-bar Undo restores attachment changes made in a command request. The older manual movement history does not track attachment metadata.
8. In **Stages**, capture a displayed setup as a checkpoint, including an intermediate preview. Enter `create 10 stages`, then `play`. Playback interpolates from the original through checkpoints to the final setup. Undo/redo a movement, group action or completed handle drag with the buttons or `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`.
9. In **Analyze**, pick two crown landmarks, inspect centre-to-centre spans, check final crown-surface intersections, or export a movement CSV. The camera button offers PNG snapshot export of the current 3D canvas.
10. **Save case** downloads meshes, axes, attachment settings, final transforms, movement history, checkpoints and appliance settings. **Open case** restores them. Export an individual stage STL or the complete stage ZIP for geometry demonstrations; see the export limits below. Older version-1 case files remain readable.

Nothing is saved automatically. Save before closing, importing another case, or reloading. STL and case files are processed locally in the browser. There is no patient database or cloud storage.

Use a regular Chrome or Edge window, or launch `START.cmd`, for file downloads. Some embedded preview browsers do not expose generated downloads. Check your browser's downloads before closing an unsaved case.

## Commands and voice

Built-in commands need no account, API key, Python process, or external interpretation request:

```text
move 11 buccally 1 mm
move selected teeth 0.25 mm mesially
move teeth 11,12,21,22 -0.5 mm z
intrude upper incisors 0.5 mm
extrude lower incisors 0.5 mm
tip tooth 13 5 degrees
torque lower incisors -3 degrees
rotate teeth 11,12 5 degrees
rotate 12 5 degrees around z
distalize upper molars 0.5 mm
expand upper teeth 0.5 mm
retract upper anterior 1 mm
reset selected teeth
select upper incisors
focus tooth 11
show upper arch
occlusal view
front view
show roots
show braces
hide braces
show before
show after
show original
add rectangular attachments to upper incisors
remove attachments from selected teeth
create 10 stages
show stage 5
next stage
play
pause
lecture mode on
next step
previous step
undo
redo
```

Supported selectors include individual permanent FDI IDs, explicit lists, selected teeth, all teeth, upper/lower arches, incisors, canines, premolars, molars, anterior teeth, posterior teeth, and an arch plus a category. Only available teeth are included in a named group. An explicit missing tooth rejects the entire action. Write a full list instead of a numerical range such as `11–18`.

Combine up to **eight supported actions** with `and`, `then`, or a semicolon. For example:

```text
show upper arch, hide gums, and select molars
select upper incisors then move them buccally 0.5 mm
show roots and show bone and make the bone transparent
```

Selection and view context advance in order. `it` means the current active tooth; `them` means the current selected group. An unqualified family such as `molars` uses the displayed arch. Movement always needs an explicit signed amount and direction; the interpreter does not invent a teaching movement from “a little”. Use `mm` for local distances and `degrees`, `deg`, or `°` for angles. Limits are ±10 mm per translation, ±180° per rotation, 2–50 display stages, and 20 saved checkpoints. These are software limits, not biologically safe values. Zero/nonfinite amounts, missing teeth, and unsupported or ambiguous commands are rejected.

The complete request is validated before execution. Use `undo that` to restore the whole request, including its selection and display changes; `redo` restores it. Use undo, redo and replay as separate requests. `return to the lesson` or `exit workflow` must be the last action in a compound request.

Important movement distinctions:

- **Tip** rotates around the stored buccolingual axis; **torque** around the mesiodistal axis; **axial rotation** around the root-to-occlusal axis.
- Ordinary single-tooth `rotate it 5 degrees` retains the legacy **world Y** default. Group `rotate teeth 11,12 5 degrees` uses each tooth's long axis. Add `around x`, `around y`, or `around z` for an explicit world axis.
- Positive angles follow the right-hand rule about the displayed positive reference vector. The pivot is the crown's bounding-box centre, not a physiological centre of resistance.
- `expand` means buccal displacement **per tooth**, not a requested total arch-width increase. `retract` means a per-tooth lingual displacement. A group rotation rotates each tooth about its own pivot; it does not orbit the group about a shared centre.

Teaching commands also control front/right/occlusal/perspective cameras, upper/lower/both arches, selection, focus, original/final comparison, visibility, stage navigation, and lesson steps. `next step` advances the active classroom workflow or case lesson; `next stage` advances a case's geometric stage preview. Known English number forms such as “tooth eleven”, “half a millimeter”, and “minus three degrees” are normalized before deterministic parsing. This is a command vocabulary, not an open-ended clinical assistant.

**Voice uses push-to-talk.** Hold **Space** while focus is outside text fields and controls, or hold the **Hold to talk** button. Speak an English instruction, then release to run it. The interface shows the heard text and whether it is interpreting, executing or speaking. It does not keep listening after the request. Typed requests use the same controller.

Use **Stop** or **Escape** to cancel listening or a pending interpretation, pause animation and stop narration. An already displayed change remains until you undo it. Say `repeat that more slowly` to replay the previous demonstration from its saved starting setup at half speed; this does not add the same movement again. Explanations are spoken **only when requested**, with `explain this step` or `explain the answer`.

The microphone is available only when the browser exposes Web Speech recognition and permits access. English recognition is requested. Browser-vendor speech services may process audio; this is not OpenAI realtime audio or OpenAI transcription. Narration uses browser speech synthesis. Typed commands remain available without microphone support. Live microphone hardware, browser recognition and live OpenAI requests have not been verified for this release; automated tests simulate those boundaries.

## Attachments and teaching exports

Attachment dimensions are 0.2–6 mm, mesial/occlusal offsets are within ±5 mm, and rotation is within ±180°. These are editor bounds. Placement uses the calibrated original tooth frame and intersects the crown surface; an uncalibrated tooth or a position that misses its crown is rejected. Each tooth stores at most one attachment specification. The planar base has a small geometric overlap at its centre; it is not a fitted bonding surface, force model, or manufacturing design.

- **Individual stage STL:** crowns, static gingiva and optional configured attachment surfaces in millimetres. Stage 0 is the original pose in the ordinary sequence, or the edit's starting arrangement for an active Try path. Resolve a pending preview before export. Roots, brackets, wires, display-only arch separation, colours and labels are excluded.
- **Stage ZIP:** `stage-000.stl` through the chosen final index plus `manifest.json`. A count of 10 means 10 intervals and **11 STL files**. The manifest records poses, checkpoints, units and geometric limitations. Checkpoints divide the path into equal-duration segments and may fall between the sampled integer stages.
- Attachment surfaces follow each crown in every exported stage. They are collected in the STL as **separate surfaces without Boolean union**. Gingiva does not deform. **No aligner shell, thickness offset, trim line, fabrication workflow or material simulation is implemented.**
- Sequence export checks a **250 MiB raw STL/manifest budget** before creating the STL buffers. Reduce the stage count or mesh complexity, or export individual stages when a batch exceeds the limit. ZIP compression is asynchronous; geometry generation yields between stages.
- The PNG snapshot captures the rendered 3D canvas, not the surrounding lecture interface, captions or HTML tooth labels. Actual PNG download behavior has not been verified for this revision.

STL does not formally encode units or preserve tooth IDs and calibration metadata. The file header and ZIP manifest identify millimetres; use **Save case** to preserve editable case data.

## Import segmented meshes

Use **Import STL models** and select already-separated teeth. Each tooth file must contain a permanent FDI ID, such as `11.stl`, `tooth_12.stl`, `31.stl`, or `41.stl`. Name gingiva files with `gum`, `gingiva`, or `gingival`, preferably `upper_gum.stl` and `lower_gum.stl`.

- ASCII and binary STL are supported. Files must share one original coordinate system; the importer preserves their relative positions and does not arrange, segment, or register teeth.
- STL has no unit metadata. Choose millimetres, centimetres, metres, or inches. Geometry is converted to millimetres without independently resizing teeth.
- Import limits are 36 files, 100 MB total input, 2 million total triangles, and bounded mesh dimensions. Keep gingiva to at most four meshes for saved-case compatibility.
- Imported teeth initially support world X/Y/Z movement. Named movement, tip/torque/axial rotation, and estimated bracket placement require anatomical calibration.
- The calibration dialog assigns three perpendicular axis-aligned directions: buccal, mesial, and root-to-occlusal. It does not reorient the mesh. Use world movement for tilted scans until suitable reference axes are available. No patient roots, anatomical orientation, or bite registration are inferred.

The `sample-models/` folder is intended for segmented-STL import practice. Regenerate the full current demo after installing dependencies:

```sh
node --experimental-strip-types scripts/generate-samples.mjs
```

Generation requires Node 22.6 or newer and writes **28 separate synthetic crown STLs plus upper/lower gum STLs**, preserving shared coordinates. It excludes schematic roots and braces. STL import does not carry anatomical calibration metadata; calibrate these imported samples or use world axes. The built-in demo already contains reference axes and root illustrations.

## Optional OpenAI service

See [backend/README.md](backend/README.md) for exact Python setup, pinned dependencies, environment settings, and mocked tests. Configure `OPENAI_API_KEY` on the server, start the service on port 8000, then connect it through Settings. No API key belongs in browser code or frontend settings.

The shared controller tries the deterministic local planner first. When wording is not recognized and you have enabled the connected service, it requests an interpretation from `/api/interpret-teaching`. The frontend sends text and minimal classroom context: available/selected tooth IDs, mode, step, display state and recent allowlisted actions. Meshes, case names and patient-ID fields are not sent. Do not put personal records into the command text. The original `/api/interpret` endpoint remains available for compatibility.

The server returns at most eight allowlisted actions or a clarification. The frontend checks the plan against the current scene and rejects stale responses before automatically running an accepted request. **There is no separate Apply confirmation in the v0.5 classroom flow.** Use the visible transcript, Stop and whole-request Undo. Missing amounts, unsupported actions or clarification requests leave the scene unchanged. The live integration requires your own credentials and has been tested with mocks only.

Version 0.7 Try Mode uses the deterministic local parser and its explicit preview/Apply flow. Its new mechanics, named arrangements and counted history are excluded from AI plans and the legacy service context; the backend API remains compatible with the earlier classroom vocabulary.

## Geometry, analysis, and saving

- One scene unit is one millimetre. Imported geometry is centred around its bounding-box centre while the mesh position preserves the original shared registration.
- Anatomical directions remain fixed in the **original case frame**. Intrusion points rootward and extrusion points toward the biting surface, with opposite upper/lower signs in the current demo.
- Rotation increments compose as quaternions in command order; stored poses use XYZ Euler angles in degrees. Playback uses shortest-path quaternion interpolation between original/checkpoint/final poses, with equal-duration segments. Stages imply no treatment duration or biological response.
- Landmark measurements are straight 3D distances at the displayed stage. Crown-centre spans and the centre-distance selector are explicitly geometric references, not clinical cusp-tip arch widths or interproximal gaps.
- Intersection analysis checks final crown **triangle-surface crossings**. It does not report clearance, penetration depth, full containment, root/gum/bone intersections, or collisions between displayed stages. A result of zero crossings is not a clinical clearance assessment.
- Brackets follow each crown and wires connect displayed bracket slots. Bracket positions, root illustrations, wire shapes and synthetic support tissues are schematic; no wire stiffness, forces, anchorage, or periodontal response are calculated. Bone and the exaggerated ligament are stationary display references, not moving or deforming tissue simulations.
- Version-2 saved cases include movement history, up to 20 checkpoints, attachment specifications and visibility, synthetic root geometry when present, and bracket/ligature settings. Camera position, temporary display separation, landmark selections, intersection results, live speech state, guided-lesson progress and classroom workflow progress are not saved. Case files must be under 100 MB when reopened.
- Direct manipulation uses world-axis handles with 0.1 mm translation and 1° rotation snapping. A completed drag changes the active tooth and is one undoable movement. Use group commands for multi-tooth movement and named commands for anatomical directions.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

Backend tests: follow [backend/README.md](backend/README.md). They mock OpenAI and cover both the original command endpoint and the new teaching-plan endpoint: strict schemas, minimal context, sequential references, exact target/amount/direction auditing, bounds, workflow/anatomy state, refusals, errors, and CORS. See the verification record for final release counts.

Frontend tests cover deterministic and compound classroom plans, narration/cancellation, whole-request history, simulated push-to-talk, anatomy display geometry, workflow frames, attachments, group operations, quaternion composition, upper/lower directions, checkpoints, STL/ZIP exports, saved cases, measurements, and mesh intersections. Run the commands above to verify your installed revision. Live microphone permissions and live OpenAI requests are separate integrations and are not verified by automated tests.

See [the verification record](docs/VERIFICATION.md) for revision-specific test counts, build results, browser checks and remaining integration limits. Earlier release checks do not automatically verify the v0.5 classroom. No live microphone or actual PNG-download verification is claimed here.

## Scope and references

This is an education and lecture prototype, **not for clinical use**. It has no automatic segmentation/numbering, CBCT registration, patient-root reconstruction, bone boundaries, biological movement model, force simulation, automatic treatment planning, aligner-shell fabrication, clinical validation, or regulatory approval. Attachments and staged STL exports illustrate geometry. File-based saving does not provide authentication, patient management, multi-user records, or cloud persistence.

See [Orthodontic references and engineering implications](docs/ORTHODONTIC_REFERENCES.md) for source-linked terminology, pivot/axis caveats, and the distinction between braces visualization and biomechanics. [Treatment workflow research](docs/TREATMENT_WORKFLOWS.md) supports the new classroom explanations with official NHS, AAO and BOS material and original studies.

Workspace inspiration comes from public [dentOne controls and comparison documentation](https://www.ezdentone.com/designsoftware-common/), [dentOne tooth-control guidance](https://www.ezdentone.com/faq/), [Smilecloud views](https://learn.smilecloud.com/en/article/design-views), and [Smilecloud direct tooth controls](https://learn.smilecloud.com/en/article/design-library-controls). They informed clearer selection, view switching and comparison; no vendor assets or application code were copied. Vendor segmentation, restorative design, CBCT and fabrication capabilities are outside this prototype's scope. [Smilecloud's Motion documentation](https://learn.smilecloud.com/en/article/introducing-motion-in-blueprint) also distinguishes illustrative animation from clinical prediction.

```text
src/components/Studio.tsx   Workspace, selections, commands, history, analysis
src/components/WorkflowStudio.tsx  Independent workflow classroom and explanations
src/components/Viewer.tsx   Three.js scene, appliance display, picking, camera
src/components/TeachingController.tsx Shared command bar, microphone and scene adapters
src/lib/demo.ts            Procedural crowns, schematic roots, gingiva
src/lib/attachments.ts     Attachment settings and crown-local teaching geometry
src/lib/lecture.ts         Teaching parser, English number forms, guided lessons
src/lib/classroom.ts       Compound plans, action validation and sequential context
src/lib/try-mode.ts        Preview geometry, locks, objectives and saved arrangements
src/components/TryPanel.tsx Try Mode controls and sampled-path preview review
src/lib/teaching-runtime.ts Ordered execution, cancellation, narration and request history
src/lib/push-to-talk.ts    Hold-to-talk browser recognition lifecycle
src/lib/workflows.ts       Source-linked workflow steps and authored display frames
src/lib/workflow-appliances.ts  Staged braces, palatal device and teaching annotations
src/lib/speech.ts          Browser speech controller and lifecycle handling
src/lib/model.ts           Movement geometry and atomic group operations
src/lib/commands.ts         Deterministic parser and remote-command validation
src/lib/planning.ts        History, checkpoints, saved-session validation
src/lib/analysis.ts        Geometric measurements and surface intersections
src/lib/geometry.ts        STL import/export and case serialization
src/lib/stage-export.ts    Stage STL and asynchronous ZIP sequence export
backend/                  Optional FastAPI/OpenAI interpretation service
scripts/generate-samples.mjs  Segmented synthetic STL generation
scripts/serve.mjs          Local production static server
out/                      Prebuilt static application
```

Technical references: [Three.js STLLoader](https://threejs.org/docs/pages/STLLoader.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html), [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports), and the official OpenAI references in the backend README.
