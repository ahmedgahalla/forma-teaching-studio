# First workspace usability pass · 24 September 2026

- Scope: more model space and a permanently available command bar, not a new solver or a complete product redesign. Camera presets now sit outside the model; the idle stage bar and unused wire-preset strip are hidden. Free lecture mode retains compact anatomy buttons. The inspector's measurement tab is named **Measure** to distinguish it from AI **Analyze**.
- Contextual examples show at most four actions appropriate to the current setup. Preview suggestions omit comparison until Apply/Discard. Examples and analysis replies float above the composer rather than pushing the command input off screen. Mobile selection/layer/tool sheets preserve the composer; opening a manual preview returns to the model with fixed Apply/Discard/Modify controls.
- Everyday dental aliases now include `put brackets in top`, `put brackets on bottom`, and explicit top/bottom tooth groups in both TypeScript and Python. Camera top/down wording, negations, conditions and numeric meanings remain preserved. Unrecognized wording may use the configured AI interpreter; recognized validation failures remain clarifications even when Ask AI is selected.
- Final automated verification: **1,599 frontend tests / 51 files passed**; **531 backend tests passed**, with one existing dependency deprecation warning; **8 gateway tests passed**. The optimized static export and its TypeScript check passed. The new React DOM regression verifies external answer reveal, card/scene-only scrolling, no repeated scrolling, and manual collapse.
- Connected-browser checks at **375×667, 760×694, and 1366×768** exercised camera placement, pinned command input, selection/tool sheets, a 0.5 mm tooth-11 buccal preview, Apply, animation, Undo, and the diastema lesson's Play/Pause and explanation. Undo of Apply restores its preceding preview as well as the prior pose; Discard exits that preview.
- `put brackets in top` installed brackets on all 14 upper teeth through the local interpreter. The same exact phrase then passed a real **openai/gpt-6-luna** request in the connected local browser and displayed “Installed brackets on the available upper teeth.” Lower teeth remained without brackets. No clinical movement is triggered by bracket installation.
- Final browser corrections verified: a revealed diastema explanation is brought into view without hiding the command bar; the stage row does not overlap it. At 375×667, preview examples sit above the fixed decision controls rather than behind them. An AI request without a movement amount asked for distance and did not move the teeth. Credential exclusion passed across 249 source/export files.
- Private Site publication succeeded at the existing URL on 24 September 2026, source `a6d5c65a37e4ed9d2e63cdfeccdfb7e909843135`, environment revision 1. The GitHub repository remains public; website access remains owner-private. Online AI still depends on the running computer/backend/bridge/tunnel. No browser application errors were recorded during the final checks.
- These are responsive desktop-browser checks, not physical-phone, real-microphone, projector or educator acceptance. Clarification follow-up memory (such as replying only “yes”), a unified edit/question intent router and collision-query optimization remain unimplemented.

---

# Hosted AI connection repair · 24 September 2026

- Reproduced the user's production failure: authenticated POST `/api/interpret-teaching` returned 503 in 1–2 ms. The local backend and authenticated public bridge remained reachable; a real interpretation through the bridge returned the expected root-visibility action.
- Root cause: the hosted Worker used `redirect: 'error'`, which Cloudflare's workerd request constructor rejects before sending a request. Node's mocked-fetch tests had accepted this unsupported option. Changed to `manual` and explicitly reject all 300–399 responses, preserving credential isolation.
- Added a redirect regression test and fixed-code-only diagnostics; errors no longer assert that the host computer is offline. **8 gateway tests passed**, including identity, origin, request bounds, analysis routing and redirect rejection. No API key or access-policy change.
- Private deployment succeeded at the existing phone URL, environment revision 1, source `24d2be74b690335c86fda71ea0c478f9c8caaa1c`.
- Verified in the user's actual signed-in hosted page: `wire in all teeth` now receives an AI clarification about prerequisite brackets; `Please reveal the roots so I can explain them to my class.` applied root visibility and displayed the AI reply. One Undo restored the prior model. This is an end-to-end hosted desktop-browser check, not a physical-phone or microphone test.
- Hosted Analyze initially received a provider 429; a later retry succeeded with `openai/gpt-6-luna`, correctly reporting no configured appliances or calculated response. Provider key status confirmed available quota. This distinguishes a transient provider limit from the repaired immediate gateway failure. Left Ask AI enabled with the original model restored.

---

# Current verification appendix · 24 September 2026 · broader language and Analyze

This update broadens bounded classroom wording and adds a separate read-only AI explanation mode. The initial-response solver and clinical limitations are unchanged.

## Automated evidence

- **Frontend: 1,577 tests passed in 50 files.** `npm run typecheck` passed.
- **Backend: 503 tests passed.** Provider responses in the automated suite are mocked; this count is not a live-provider test.
- Shared TypeScript/Python fixtures verify matching everyday-language aliases, including polite classroom prefixes, top/down camera wording, visible anatomy, explicit upper/lower front/back groups, numeric signs and retention of unknown or guarded clauses.
- Explicit upper/lower front-six and six-front-teeth aliases map to anterior groups before spoken-number conversion; front-four aliases map to incisors. Tests preserve their group meaning without mistaking the count for a movement amount or tooth ID.
- Whole-arch wire tests cover visible-arch targeting, explicit both-arch targeting, missing bracket prerequisites, separate ordered upper/lower wires, reuse/extension, ambiguous overlaps, missing activation and rejection of invented or omitted actions. Complete-request preflight and undo remain in the execution path.
- Recognized complete selection/appliance requests can supply deterministic action hints to the provider only after independent source validation. The actual provider is still called and its returned plan is validated again. Unknown or ambiguous requests receive no such hint. An empty appliance configuration in an active synthetic experiment does not require inventing an experiment-opening action.
- Analyze sends projected scene facts only, accepts a strict text-only explanation schema, does not apply/preflight scene actions, and creates no command-history entry. Hidden, stale or imported-model calculations are not exposed as current teaching results. Tests reject action-bearing replies and stale responses after cancellation, scene changes or superseding questions.
- Manual-control regression: with both the AI preference and Analyze active, `runControl('show roots')` executes locally without a network request; one Undo restores it while Analyze remains selected. Production manual controls were audited for the same route.
- The configured server default is GPT-6 Luna (`gpt-6-luna`, or `openai/gpt-6-luna` through OpenRouter). `OPENAI_ANALYSIS_MODEL` optionally overrides the model used for explanations. This records configuration, not a provider availability guarantee.

## Direct live-provider checks

- The configured `openai/gpt-6-luna` provider interpreted `Select the upper front six teeth and move them buccally by one millimeter.` against a 28-tooth scene with the upper arch visible. It returned the correct upper-anterior selection and a 1 mm buccal group movement; independent backend validation passed. This single request took 6.16 seconds.
- After the validated action-hint update, `Put wire on all teeth` against a 28-tooth scene with both arches visible returned four validated passive setup actions: missing upper brackets, an upper wire, missing lower brackets, and a lower wire. This single request took 3.17 seconds.
- `Select the upper anterior teeth, install brackets on them, and put a wire through those brackets.` returned the correct three actions in 3.76 seconds. `Put a wire on the upper anterior teeth.` returned missing brackets plus a passive wire in 3.33 seconds. Both real provider replies passed independent validation.
- These are direct API integration checks, not a browser walkthrough, recorded UI result, real-microphone test or performance guarantee.

## Browser and release acceptance for this update

- Connected-browser walkthrough passed with real Luna replies: upper arch/root/gum request; upper-anterior buccal 1 mm movement; exact `Put wire on all teeth` with 28 brackets and two ordered archwires; compound selection/brackets/wire; activation by half a millimetre followed by calculation; and a 0.5 mm single-tooth edit in an explorable lesson.
- Read-only Analyze returned a scene-grounded answer explaining passive wires, zero activation and absence of a calculation. A separate live request for an exact patient treatment timeline correctly declined to invent one.
- Manual browser checks: FDI chart selection of 11, 1 mm buccal preview/apply and 8 degree axial rotation preview/apply, full animations, saved arrangement, original overlay, complete-request undo, lesson variation, return to prepared case, and restoration of the prior workspace.
- Recorded the diastema lesson and alternate midpoint, labelled anatomy cutaway, translation/tipping, and fixed-brace bracket/wire/alignment/retention steps. This is a feature tour, not a recording of every supported command. Mechanical response shown: actual maximum 0.0118 mm and 0.077 degrees; the visible 50x magnification label remains on screen.
- Responsive browser check at 390 x 844: model, Ask AI, Analyze, command input and Stop remain visible. This is emulation, not a physical phone test.
- New casual screen-capture video uses actual browser interactions with typed natural-language input and numeric manual controls, no narration/music or fabricated UI. Captured content is 1920 x 1061, padded at the bottom to a 1920 x 1080 MP4; inactive gaps between recording batches are shortened. The final MP4 is 278.03 seconds (4:38), H.264/yuv420p, 1920 x 1080 at 30 fps, 9,199,061 bytes. Full FFmpeg decode completed without errors. No audio track was synthesized.
- Production build and TypeScript check passed. The phone gateway passed 7 route/authentication tests. Credential exclusion check passed across 247 source/export files. Private publication succeeded at the existing Forma phone URL on 24 September 2026. Site source b991c4918f7d983492496f26e9af34f656fa641f includes the authenticated analysis gateway and the new video. Existing owner-only access is unchanged. The live API reports openai/gpt-6-luna for both interpretation and analysis. The computer-hosted AI service must remain running for online AI.
- Packaged download: Forma-Dental-Studio.zip includes the current source, exported local app, synthetic model assets and documentation; ZIP integrity passed for 248 files. Runtime credentials and dependency/build caches are excluded.
- Actual English microphone recognition, physical-phone touch behavior, projector readability and orthodontic educator review remain unverified. Typed commands and simulated recognition do not establish these.
- Analysis is an explanation of supplied educational scene facts. It does not inspect images/meshes, diagnose, predict treatment duration or establish clinical validity.

---

# Earlier verification · 24 September 2026 · visible mechanics and Ask AI

This update makes the existing initial elastic response easier to see and lets the professor explicitly send a typed instruction to the configured AI interpreter. It retains the same synthetic anatomy, deterministic calculations and independent command validation.

## Completed checks

- **Frontend: 1,493 tests passed in 47 files.** The production build passed.
- **Backend: 389 tests passed.** The full Python suite includes phone-bridge coverage and retains one existing Starlette/AnyIO deprecation warning.
- **Ask AI** forces a provider interpretation request instead of silently satisfying recognized text locally. Command status distinguishes AI interpretation from local execution. Stop and manual controls remain local; cancellation, context revision checks, whole-request preflight and result validation are retained.
- Written millimeter/millimetre quantities and singular/plural degrees are normalized consistently with the frontend. Tests exercise compound natural-language wire activation and solve requests, correct half/quarter values, and rejection of altered quantities or missing/wrong units.
- Strict output schemas put action discriminators before inherited payload fields. Regression checks cover SDK schema order, unchanged validation constraints, correct group selection, wrong targets and unexpected fields. No numerical or target audit was relaxed.
- Calculated wire-response replay automatically chooses a display scale bounded at **50×**, shows the unloaded-reference ghost and displacement traces, and lasts **eight seconds** at normal presentation speed. Actual displacement and rotation remain unscaled; saved geometry and the unloaded solver reference are unchanged. This is an initial elastic response, not a biological timeline.

## Private phone publication

Native Sites publication succeeded at https://forma-teaching-mobile.ahmedgah123.chatgpt.site with the existing owner-private audience:

- Project: `appgprj_6ab39ed0b82881919f49cba3045245ce`
- Version: `appgprj_6ab39ed0b82881919f49cba3045245ce~appgver_928a60f20a3c8191b0e1a6b49e46b9ef`
- Deployment: `appgdep_6ab4e3d5133c8191a02d693198755117`
- Site source commit: `9af5d4dcf4a76f53539592c458d060a9289f1b71`
- Environment revision: `1`

## Live browser and recording

- The connected browser executed five real OpenRouter interpretations with Ask AI enabled: natural-language upper-jaw/root/gum presentation, upper-anterior selection, bracket placement (including “for me”), passive wire installation, and half-millimeter activation plus response calculation. The response completed at 0.0116 mm / 0.076 degrees with a labelled 50× display scale. Focus, occlusal camera, complete replay and Undo were exercised through normal controls.
- `../../Forma-Fullscreen-AI-Demo.mp4` is an 81.17-second silent, casual 1920×1080 capture, encoded as H.264/30 fps from actual browser frames (roughly 8–10 captured frames per second). Recording pauses between interaction batches are removed. No fabricated screen states, AI replies, narration or decorative titles were added. Video dimensions and full decode were verified.
- An additional real provider request replaced a wire with 0.018 inches (0.4572 mm) and returned exactly one solve; backend semantic validation passed. Adjacent requested recalculation is coalesced with the replacement's required recalculation in both validators and local planning.
- During debugging, some provider plans added or omitted actions and were correctly rejected without scene changes; an AI camera request also received a rejected plan. This is bounded command interpretation, not a guarantee of arbitrary language understanding. Manual camera controls and local commands remain available.
- A 390×844 browser check found no horizontal overflow, with Ask AI and Stop visible. This is viewport testing, not physical-phone testing. The temporary viewport override was reset.
- One expensive GLB collision regression exceeded its existing 30-second timeout while video encoding was running. A separate full-suite rerun, with encoding finished, passed all 1,493 tests without changing test limits.

Publication success does not establish physical-phone behavior, actual microphone capture or educator approval. Online AI still uses the temporary authenticated connection to the host computer; see [phone testing](MOBILE_TEST.md).

---

# Historical verification records

The sections below preserve the checks and deployment status at each earlier release. Their test counts and statements about remote publication are historical; the current status is recorded above.

# Version 0.12 verification · conversational teaching experiments

Verified locally on 24 September 2026. Forma now supports pointing, typed/hold-to-talk appliance commands and a bounded initial elastic mechanics engine in the existing free workspace. This is a synthetic teaching system; it does not predict treatment time, remodeling or patient outcomes.

## Delivered and automated checks

- Frontend: **1,459 tests passed in 46 files**, zero failures (25.62 s, run started 05:25 UTC). Backend: **335 tests passed in 3 files**, with one existing AnyIO deprecation warning. Later manual-camera callback fixes passed 77 targeted controller/runtime/workflow tests and strict TypeScript. Final optimized static export passed after those fixes and mobile layout changes.
- Shared worker calculations cover coupled wire beams and ideal bracket engagement, tension-only TAD connections, and compliant expansion. Independent beam, spring, expansion and force/moment balance benchmarks pass. Stage replay uses the unchanged reference; magnification changes display poses only. Worker tests cover timeout, termination, stale replies and synchronous post failures.
- Whole-request history includes layers, camera, poses, selection, appliances and experiment state. Command tests cover ordered references, replacement, missing-value clarification, preflight, cancellation and provider-output validation. Eight mounted React speech-controller tests use fake recognition; they do not establish real microphone performance.
- The actual Blender/GLB asset contains **28 differentiated crowns, 28 connected root objects and two gums; 211,452 triangles**. Four synthetic dental Class I/II-1/II-2/III starting arrangements have zero detected crown/root triangle-surface crossings. Dental arrangement and skeletal classification remain separate. Existing authored demonstration crossings remain explicitly reported.
- Saved-case tests cover v1/v2 compatibility and v3 optional anatomy, original arrangement, mechanics configuration and lecture presentation state. Imported meshes are preserved; saved calculated results are discarded and recomputed from validated inputs. Camera fitting was independently checked against actual model vertices at phone dimensions; the mobile tools were moved to prevent covering posterior teeth.
- The sampled crown-collision preview for six anterior teeth improved from approximately 8.6 s to **48 ms cold / 16 ms warm** in the local numerical check. These are workstation measurements, not a university-laptop performance guarantee. Collision sampling is not a continuous clearance, root/bone or biological-safety test.

## Connected-browser verification

Performed in the connected Chromium in-app browser, with 1280×720 and 390×844 layouts and both Clinical and Midnight themes:

- Installed brackets on six selected teeth and a wire using a compound instruction. Passive hardware prompted for activation instead of moving teeth. Undo/Redo restored the complete installation request.
- Activated a 0.016-inch stainless-steel wire by 0.5 mm. The final registered-slot build calculated maximum physical displacement **0.0116 mm** and rotation **0.076°**. Replacement recalculated from the same baseline. The initial response animated and carried a persistent 10× display label with unscaled numeric values.
- Pointed at gingiva near tooth 23; placed a TAD at the marker and connected six bracket points with 1 N total specified tension. The configured result displayed individual elastic tensions and anchor reaction. Comparing without that TAD preserved the main experiment and its unloaded reference.
- Added a compliant expander to the wire/TAD configuration with 0.1 mm activation, 10 N/mm appliance stiffness and 20 N/mm declared palate stiffness. The UI displayed force plus dental/support/appliance displacement components. This verifies interaction with the combined engine, not clinical plausibility of the chosen numbers.
- Stop paused playback and prevented the remaining visibility action. A subsequent camera → roots → halfway compound request completed all three actions. Prediction mode hid the result until Reveal; reveal began animation.
- Switched to dental Class II division 2, then used one Undo to restore the prior wire experiment at 50%, including roots and front camera. A newly loaded class starts with zero edited teeth relative to its own original arrangement.
- Downloaded a v3 case, reopened it through the file picker, and verified recalculation restored the same 0.0116 mm / 0.076° result, selected group, wire activation, roots, front camera and 50% stage.
- Phone layout keeps command entry, microphone and Stop reachable. Opening the inspector resizes the model above the sheet instead of covering it. Temporary viewport overrides are reset at delivery. This is browser viewport testing, not physical phone-touch verification.
- Connected the local backend to **OpenRouter** and verified its setting survives reload. A real provider request, “Could you conceal the gingiva and reveal the roots for my explanation?”, returned and executed both supported actions. Earlier live provider checks covered appliance actions and clarification. Independent validation rejected a provider-supplied numeric mismatch without moving the model.

## Delivery and remaining checks

The local app runs at `http://127.0.0.1:3000`; the AI backend remains bound to `127.0.0.1:8000`. Credentials stay in the ignored backend environment and are excluded from source, frontend assets and the downloadable package. This local AI connection is not a public/mobile backend deployment.

Actual English microphone capture in Chrome/Edge, physical touch interaction, projector-distance readability, typical classroom laptop frame rate and orthodontic educator review remain **unverified**. Root forms, support matrices, slot behavior and appliances are simplified teaching assumptions. No faculty approval, patient-specific biomechanical validation or learning-outcome claim is made. NiTi hysteresis, biological timelines and remodeling remain deferred.

See [commands](CONVERSATIONAL_COMMANDS.md), [professor guide](PROFESSOR_GUIDE.md) and [release checklist](RELEASE_CHECKLIST_0.12.md) for scope and final packaging evidence. The existing hosted phone site is not updated by this local release.

---

# Version 0.11 verification · interactive university lectures

Verified locally on 23 September 2026. The release improves classroom interaction, renderer readability and selection framing. It leaves source anatomy, authored paths and case-file format unchanged.

## Delivered

- Natural enamel with selected crown/root contours; restrained cached cavity shading and controlled lighting. Group focus includes transformed crowns and roots. Isolation removes surrounding teeth and whole-arch hardware; Left joins the camera presets. Labels avoid overlapping one another.
- Shared professor console in both case and workflow workspaces. Wide screens put the question and playback beside the model; narrow screens stack them. Visual answer reveal is separate from requested narration.
- Bounded `progress` actions seek directly to a finite 0–1 presentation position, including fractional display stages. Prepared “play demonstration”, “pause demonstration” and “pause halfway” commands route to the appropriate authored case. Workflow midpoint seeking chooses its authored movement step without playing through it first.
- Question display is captured in whole-request undo/redo. Preflight remains read-only and validates every action before changes. Runtime camera + question undo/replay regressions are covered.
- Lecture pointer does not select or transform teeth. Escape or Exit pointer restores orbit interaction.
- Professor guide and persistent product-priority instructions. No automatic treatment planning or new clinical claims.

## Automated checks

- Final frontend suite covers **1,303 tests in 35 files**. The concurrent full run passed 1,301; two existing geometry-heavy tests exceeded their wall-clock limits while building and rendering. Both affected files were rerun alone with one worker: **42/42 passed**, without changing test thresholds or implementation.
- Backend: **297/297 passed**; one existing Starlette/AnyIO deprecation warning.
- Final strict TypeScript with noUnusedLocals/noUnusedParameters: passed. Final optimized static export: passed.
- Ten stylesheets parse with no undefined theme tokens. Tested palette text contrast remains above 4.5:1; this is not a complete accessibility audit.
- Local page and ten referenced JS/CSS/model assets return HTTP 200 and match the final export bytes. GLB content type is correct.
- Renderer tests cover contours, group bounds, isolation, camera fitting and label placement. Source GLB/metadata hashes and source mesh position/normal/index buffers remain unchanged. Cached cavity computation was approximately 52 ms over the 28 shipped crowns in the local numerical check, not a device performance guarantee.

## Connected-browser checks

Performed through the real connected in-app browser on a separate test tab, preserving the original user tab:

- Clinical and Midnight rendering; linked crowns and roots; selected upper-front-six isolation and group focus; labelled tooth/socket cutaway.
- Prepared movement case: reveal answer -> visible, Undo -> hidden; halfway -> 50%; one slider increment -> 51%.
- Anatomy workflow: midpoint from assessment enters translation at 50% immediately; Restart returns the current demonstration to 0% and hides its answer.
- Lecture pointer activation leaves playback running; pointer interaction and Escape exit work.
- Final side-by-side desktop model/question layout at the default 1280×720 viewport. Tablet at 800×900 and phone-sized 390×844 layouts stay within page width. Phone question and revealed answer are reachable. Viewport override reset afterward.
- No browser console warnings or errors were captured in the final test tab.

## Still requires direct human review

Actual microphone speech, physical touch orbit, university laptop frame rate, projector readability at classroom distance and faculty review were not validated by this pass. Supporting tissues and movement remain synthetic illustrations. Existing sampled collision/path-audit limitations and known case crossings still apply; neither roots/bone constraints nor biological response are inferred from these display changes.

The local build and ZIP contain v0.11. The remote private phone publication remains v0.8 and was not updated in this release. See [Professor guide](PROFESSOR_GUIDE.md) and [mobile status](MOBILE_TEST.md).

---

# Version 0.10 verification · Midnight Lab interface

Verified locally on 23 September 2026. This release changes the classroom interface and renderer display palette; it preserves geometric editing, teaching cases, anatomy assets and case-file formats.

## Delivered interface

- Midnight Lab default and Clinical Studio bright theme, with browser-local preference. Both the workspace and workflow classroom share the setting.
- Narrow desktop rail with selection/layer drawers and collapsible editing tools; mobile sheets and 44px primary touch controls.
- Persistent preview decisions outside scrolling/hidden panels. The bar reuses the existing lock/collision eligibility, reports sampled geometry, and opens the full inspector through Modify. Its measured height sets the mobile sheet offset and page padding.
- Short-height preview layout, accessible names for icon controls, larger functional text and lecture captions. Tool-rail navigation and theme switching do not cancel the running instruction.
- Theme changes recolor the existing backdrop and guide materials without rebuilding the scene or resetting camera/poses. Natural tooth/tissue materials remain unchanged.

## Checks completed

- Full frontend suite: **1,237 passed in 33 files**. The initial run could not create its temporary cache in the system temp directory; rerunning with TEMP/TMP in the workspace and two workers passed. The final preview-height change was followed by **18 passing targeted preview/renderer tests**.
- Final strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed.
- Final optimized Next.js static production export: passed.
- Backend: **269 tests passed**, one existing Starlette/AnyIO deprecation warning. This includes the previous fractional-stage / pre-lesson context fix now included in the package.
- Eight stylesheets parse successfully with PostCSS; no unresolved shared theme tokens.
- Calculated core text contrast in both palettes exceeds 4.5:1. The lowest tested pair is Clinical muted text on raised panels at **5.02:1**. This is token validation, not a complete accessibility certification.
- Local server: HTTP 200 for the page and ten referenced scripts/styles/model assets, byte-identical to the production export. GLB served as `model/gltf-binary`.
- Preview component checks include blocked, limited, unchecked, checking and locked requests; explicitly unrestricted requests; busy controls; no-preview state. Renderer tests verify in-place backdrop updates and guide contrast.

## Remaining visual checks

**No browser/device interaction pass is claimed.** Browser inventory was empty and opening the in-app browser returned unavailable. Actual desktop/mobile appearance, short-screen scrolling, keyboard interaction, touch orbit, theme persistence on reload, projector legibility and live microphone capture remain to be checked in a connected browser. Source review corrected the identified control visibility, navigation-cancellation and small-height issues; that is not a substitute for rendered QA.

The runtime anatomy and authored case-path limitations recorded in version 0.9 below still apply. No new patient-specific prediction or biological validation is introduced.

See [UI guide and device checklist](UI_GUIDE.md), [machine-readable style/asset verification](ui-verification.json), and [current mobile publication status](MOBILE_TEST.md). Local production app: `http://127.0.0.1:3000`. Packaged download: `../Forma-Dental-Studio.zip`.

---

# Version 0.9 verification · Blender anatomy and interactive cases

Verified locally on 23 September 2026. This release refines the reusable synthetic model in Blender, adds a 12-case/19-demonstration library, connects prepared scenes to free exploration, adds a removable-retainer illustration and changes the mobile workspace layout. It does not calculate patient treatment or tissue response.

## Software checks

- Final `npx vitest run --maxWorkers=2`: **1,224 tests passed in 32 files**. Earlier concurrent runs exposed one five-second timing timeout and a stale generated audit; the isolated timing test passed, the audit was regenerated against the final case source, and the final full suite passed.
- Strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed.
- Optimized static export: passed; rebuilt after final audit generation.
- Local server health and model endpoints: HTTP 200. GLB is served as `model/gltf-binary`; metadata contains 28 teeth and two gums.
- Case tests cover distinct keyframes, directional movement, shared baselines, source immutability, invalid requests and exact model registration. Command tests cover aliases, standalone context rules, clarification and AI rejection of unsupported local actions.
- Seven runtime case tests cover model identity, previous workspace preservation, free exploration/return, whole-request undo/redo/replay, stopping partial playback and failed-load rollback. These use scene-host test doubles; they are not mounted-browser interaction tests.
- Existing case-file, speech lifecycle, anatomy, workflow, appliance, collision-preview and original runtime tests remain in the passing full suite.

## Anatomy and authored paths

- Blender 5.1.1 was already installed and used. Delivered: editable `.blend`, runtime GLB + metadata, inspected rendered contact sheet, rebuild scripts and geometry verification report.
- GLB: **58 closed meshes, 163,044 triangles, 2,986,404 bytes**. All original tooth pivots, anatomical frames and bracket anchors remain paired with their meshes. Root forms were intentionally refined; their largest bounding-box difference from the procedural source is 0.893 mm.
- Geometry checks verify 28 attachments/bracket placements, nine appliance display configurations, six tooth/socket cutaways and 28 removable-retainer pockets. Both original and registered reference arrangements have zero detected crown crossings.
- The case audit measures **175 frames across 19 demonstrations**, using nine uniform samples plus authored keyframes. No root–root crossings were found at those samples. Known crown crossings remain in the crowding, posterior-crossbite and fixed-jaw posterior-extrusion illustrations; the UI identifies the affected pairs and marks involved teeth amber. The audit explicitly does not establish a continuous collision-free path, clearance, root-to-crown separation or biological feasibility.
- Audit provenance tests bind the report to the exact GLB, metadata and final case-source hashes. See [case audit](TEACHING_CASES.md) and [Blender asset verification](../assets/anatomy/verification.json).

## Interface, persistence and limits

- Source review corrected touch Pause restart, comparison stage jumps, Orbit stage jumps and prepared-case return display restoration. Mobile controls include Model, Select, Layers, Tools and Stop, with playback beside the model. The library is searchable and variations have prediction questions and linked reading.
- Returning from a free case variation restores the saved prepared progress, model metadata, camera, selection, layers and appliance settings. Choosing another variant starts at its baseline. Whole-request history captures the scenario and display state.
- Saved editable case files retain their geometry and existing supported editor data; prepared-case identity, return links, earlier-workspace backups and the lesson-only removable tray overlay are session-only. Save after Explore to keep an arrangement.
- **Rendered browser/device verification remains unavailable:** enabled browser inventory was empty. No new desktop/mobile WebGL screenshot, real phone touch test, actual English microphone test or live OpenAI test is claimed. The contact sheet is an inspected Blender render, not a browser screenshot.
- Cases and explanations are draft teaching examples awaiting educator review. No clinical validation or learning-outcome claim is made.

## Delivery and mobile publication

The local production build and `../Forma-Dental-Studio.zip` include the runtime assets, editable Blender source, code and command guides. The local server runs at `http://127.0.0.1:3000` on the host computer.

The existing private phone link remains [Forma mobile](https://forma-teaching-mobile.ahmedgah123.chatgpt.site), serving **v0.8**. The v0.9 publication attempt could not connect to the source hosting service; no v0.9 source version or deployment was submitted. The earlier hosted build was left intact. Browser and network availability must be restored to complete the remaining device check and online update.

Read [the professor's case guide](CASE_WORKSPACE.md), [Blender guide](BLENDER_MODEL.md) and [mobile test record](MOBILE_TEST.md).

---

# Version 0.8 verification · combined teaching workspace

Verified locally on 23 September 2026. This release connects prepared workflow arrangements with Try Mode and shares the appliance display controls. It adds no new tissue-response model or automatic treatment planning.

## Mobile access follow-up

- The static server now accepts the explicit `FORMA_HOST` override; its default remains `127.0.0.1`.
- `node --check scripts/serve.mjs` passed. The default server on port 3000 and a separate Wi-Fi server bound to `192.168.1.65:3001` each returned the expected health response from the host computer. Phone connectivity and firewall behavior remain unverified.
- The initial private publication was blocked by network restrictions. After network access was enabled, publication succeeded on 23 September 2026 at [Forma mobile](https://forma-teaching-mobile.ahmedgah123.chatgpt.site). Sites returned `succeeded`; all 23 hosted files matched the tested export. See [mobile test and deployment record](MOBILE_TEST.md). Device/browser behavior remains unverified.

## Automated verification

- `npm test`: **988 tests passed in 27 files**.
- Strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed.
- `npm run build`: optimized static export passed after the final source changes.
- The local production server responded at `http://127.0.0.1:3000`; `/forma-health` returned `{"app":"forma-dental-studio","status":"ok"}`. This establishes server availability, not browser rendering.
- Workflow transfer tests cover exact displayed poses at intermediate progress, temporary variations, source metadata, attachment copies, anatomical display flags and selected teeth. Copied metadata and poses are independent; immutable geometry is shared. Replaced or incompatible prepared geometry is rejected before transfer.
- The fresh experiment retains a `Workflow start` comparison snapshot and clears pending edits, locks and free-edit replay history. Source authored paths are not applied to the copied arrangement.
- Appliance tests cover all six presets, captured phase/opening mapping and strict saved-setting validation. The display adapter suppresses authored force arrows. Existing bracket, wire, expander, attachment and root-renderer regressions remain in the passing suite.
- Local-command tests cover the standalone workspace commands, context gating, pending-preview rejection, all appliance presets, compound commands and external-AI rejection of these local actions. Explicit UI progress and palate values validate strictly and survive the action pipeline; preset-only voice/text commands keep their defaults.
- Shared-runtime tests run `try this setup` → `place palatal expander` → `return to lesson` → `restore my workspace`, with undo/redo after each request and counted undo/redo. Display metadata changes leave tooth displacement unchanged. These exercise the runtime host contract, alongside the real scene-transfer unit tests; they do not mount the React provider.
- New case-session tests round-trip presets, fractional opening and palate visibility, retain older sessions with no appliance field, and reject malformed or nonfinite values. Existing case format and Try Mode persistence tests remain passing.
- No backend code or live OpenAI behavior changed in this release.

## Static integration review

- The shared controller preflights the complete transfer before importing it, switches views after import/restore, and captures both mounted scenes for whole-request undo. Source return uses the captured workflow snapshot; original-workspace return uses the first preserved case snapshot.
- Case restoration copies the legacy lesson-history array before subsequent lesson navigation, keeping stored return and undo snapshots independent.
- The palette forwards its complete value, including opening and palate visibility. All action-driven changes validate that value before display. Palatal hardware and retainers use the existing renderer and follow its displayed tooth transforms.
- `None`, the appliance master toggle, imported calibration, attachments and synthetic-only preset restrictions retain explicit behavior. The cutaway includes a hint when it hides a selected full-arch appliance.
- The source lesson card contains the explanation, question, answer and source links. Layout rules provide wrapping and scroll space on smaller screens; they have not received new visual verification.
- Source return links and the previous-workspace backup are session-only. Saved case files include appliance settings but not these return snapshots. Imported cases do not acquire synthetic roots, bone or expander anatomy.

## Not verified in this session

- **Browser visual and interaction verification was unavailable:** the enabled browser inventory was empty. No v0.8 desktop/mobile screenshots, WebGL inspection, rendered camera-return walkthrough or mounted-provider UI test is claimed.
- **Actual English microphone recognition and live OpenAI requests remain unverified.** Simulated speech tests remain in the passing suite; they do not verify device permissions or recognition quality.
- Prepared lessons retain their existing illustrative status. No faculty review, patient prediction, continuous collision guarantee or learning-outcome validation is claimed.

Read [Guided lessons and free exploration](COMBINED_WORKSPACE.md) for transfer, return, playback and save behavior. The geometric limits documented for v0.7 below still apply. Blender was not required or installed.

---

# Historical baseline: version 0.7 verification · Try Mode

Verified locally on 23 September 2026. Try Mode is the default case workspace. It performs explicit geometric edits and bounded objectives on the current arrangement; appliances do not calculate or predict tooth movement.

## Automated verification

- `npm test`: **874 tests passed in 25 files**.
- Strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed.
- `npm run build`: optimized static export passed after the final source changes.
- Local production server: started successfully at `http://127.0.0.1:3000`; `/forma-health` returned `{"app":"forma-dental-studio","status":"ok"}`. This is a server check, not browser verification.
- Engine tests exercise rigid group rotation throughout its path, independent arch fitting, explicit gap-closure rules, symmetric pair distance changes, tooth locks, replacement of the last movement without accumulation, and atomic rejection of invalid edits.
- Path tests include an intermediate crossing with clear endpoints, starting intersections, a crossing that recurs after separation, sampling-budget exhaustion, and the real high-resolution synthetic model. Default Apply rejects newly detected crossings and an exhausted sample budget. The explicit unrestricted option never bypasses locks.
- Parser/runtime tests cover bounded English commands, references to earlier selections in a compound request, ambiguity before mutation, stale-response cancellation, complete-request undo/redo and counted history. New sandbox actions are accepted only from the built-in parser or validated buttons; the optional AI endpoint remains unchanged.
- A regression confirms that unfamiliar earlier classroom wording can still reach the configured interpreter from Try Mode. Recognized incomplete or conflicting local edits clarify without contacting AI, and an external response cannot supply new Try actions.
- Integration tests run the real parser, shared executor and geometric engine together: select/preview/apply, whole-request restoration, lock rejection before earlier actions execute, one pending edit at a time, noncumulative revisions and named comparison overlays. These are model-level tests, not a mounted browser interaction test.
- Stage-export tests verify that every exported stage and its manifest use the same frozen trajectory as the viewer, including a rigid rotation from a non-original start. Existing five-argument exports remain compatible.
- Case-session tests read the earlier format without Try metadata and round-trip optional locks, arch targets, saved arrangements and custom groups. Invalid identifiers and the reserved snapshot name “original” are rejected. Unfinished previews and transient command history are not serialized.
- Existing anatomy, linked crown/root, appliances, import, calibration, measurement, simulated push-to-talk and prepared-workflow suites remain in the test run. No backend changes or new live OpenAI requests are included in this release.

## Static integration review

- New edits, saved arrangements and original/saved overlays have explicit pending-preview rules. When a committed edit is paused partway, choose **After** before making a new edit or saving an arrangement; replacement of the last amount remains available.
- Apply/Discard remains outside the inspector in lecture mode or when another inspector tab is selected. CSS permits the review card and model to scroll, and includes mobile input sizes; those layout rules still need visual verification.
- Locked teeth are indicated in the chart and model. The pointer handle cannot attach to a locked tooth. Prepared lesson restores check changed locked poses, and stale Try trajectories are cleared when the case is edited outside Try Mode.
- Imported teeth retain case-axis editing and access to the existing calibration dialog. Synthetic arch fitting and generated supporting anatomy remain unavailable for imported scans.
- The visible lower-arch guide follows display-only arch separation. Pending previews use the cyan overlay; original/saved comparisons resume after Apply or Discard. Legacy checkpoint controls are hidden while Try Mode uses the latest edit trajectory.

## Not verified in this session

- **Browser visual and interaction verification was unavailable.** The enabled browser inventory was empty and browser creation reported unavailable. No new desktop/mobile screenshots, WebGL console inspection or pointer/keyboard walkthrough is claimed for v0.7. The v0.6 browser checks below are historical and do not verify the new Try controls.
- **Real microphone recognition and live OpenAI interpretation remain unverified.** Simulated speech tests do not establish device permissions, speech-service availability or recognition accuracy. New Try commands can be typed without a network or API key.
- No faculty review, clinical validation, treatment recommendation, learning-outcome evaluation or tissue-mechanics calculation is claimed.

## Geometric limits

The collision report checks sampled crown-triangle crossings, with starting intersections reported separately. It does not prove continuous clearance, detect fully enclosed volumes, or assess roots, gingiva, bone or biological limits. The maximum is 33 sampled positions; large or fast rotational paths may require a smaller edit or explicit unrestricted illustration. “No new intersections detected” is not a clinical safety assessment.

Gap closure uses projected crown bounds along the line between two centres. Pair span means their three-dimensional centre distance, not a clinical cusp-tip transverse width. Arch fitting places selected centres on an editable X–Z ellipse while preserving height and orientation; it is not an orthodontic alignment or space-planning solver. Playback progress is geometric progress, not treatment time. Displacement traces connect crown centres and are not calculated force vectors.

See [TRY_MODE.md](TRY_MODE.md) for commands and [VOICE_CLASSROOM.md](VOICE_CLASSROOM.md) for the retained voice and anatomy controls.

---

# Historical baseline: version 0.6 verification · dental model presentation

Verified locally on 23 September 2026. This release refines the authored synthetic teaching model and its rendering; it does not introduce patient anatomy reconstruction or tissue simulation.

## Automated checks

- `npm test`: **792 tests passed in 23 files**.
- Strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed.
- `npm run build`: optimized static export passed.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- New morphology tests check smooth anterior crown profiles, incisor/canine differences, premolar/molar cusp relief, cervical root emergence and rounded apices. Gingiva/socket tests check closed geometry, nondegenerate faces, interdental clearance, posterior openings, apical support and cut-section normals.
- Display-surface tests confirm that colour gradients do not mutate source geometry, positions or topology, and follow the upper/lower anatomical axis. The studio background is generated locally.
- Appliance regressions retain bracket child/anchor contracts, wire registration, resin-pad attachment and resource disposal. The existing movement, teaching-command, history, speech-controller, STL and case-format tests remain in the passing suite.
- Backend code is unchanged from v0.5; the previous 238 mocked backend tests are recorded below, not claimed as a new run.

## Visual and interaction checks

- Inspected the revised full arches, anterior surfaces and upper occlusal cusps in the browser. Horizontal crown bands are removed; crown, root, gingiva and metal finishes use separate shading. A translucent surface replaces the original-position wireframe.
- Inspected the labelled cutaway, completed translation and tipping animations, and original-position overlay. Supporting tissues remain stationary while root and crown move together.
- Fixed-braces installation and alignment reach the endpoint with brackets following their crowns and the archwire following the bracket slots. The retention view shows the lingual wire and resin pads; the palatal workflow shows posterior bands, central body and connecting arms.
- Checked expander and cutaway layouts at **390 × 844** as well as the desktop viewport. The complete cutaway fits, tissue labels remain readable, and Stop remains available. No horizontal overflow was observed; the temporary viewport override was reset.
- Screen-space contact shading is disabled for transparent overlays, the schematic palate, cutaways, visible supporting tissues and manipulation/measurement tools, avoiding opaque shadow artifacts from those displays.
- The final optimized production build was checked with the full lecture model, roots through translucent gingiva, whole-request Undo, and the fitted palatal appliance. No JavaScript warnings or errors were recorded in that walkthrough.

## Limits retained

- Anatomy is authored and schematic, not photorealistic or clinically validated. The periodontal ligament remains intentionally enlarged. The new full synthetic crown/root/gingiva model contains approximately 406,304 triangles before appliances and overlays; frame rate has not been benchmarked on a range of devices.
- Imported scans do not acquire invented roots or bone. Display-only gradients leave exported source meshes unchanged. Older saved cases keep their stored meshes; create a fresh synthetic classroom/model to see the revised morphology.
- Real English microphone recognition in Chrome/Edge and live OpenAI interpretation remain unverified. Their v0.5 implementation, simulated coverage and setup instructions are preserved below and in [VOICE_CLASSROOM.md](VOICE_CLASSROOM.md).
- Canvas PNG exports omit HTML anatomy labels. Use a screenshot when a slide needs the labels.

---

# Historical baseline: version 0.5 · voice-directed classroom

Verified locally on 23 September 2026 with Node.js 24.14.0. These checks establish software behavior, not clinical prediction or validation.

## Automated checks

- `npm test`: **777 tests passed in 21 files** after the final translation-view change.
- Strict TypeScript (`--noEmit --noUnusedLocals --noUnusedParameters`): passed; optimized production build TypeScript checks also passed.
- `npm run build`: successful optimized static Next.js export.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- Python backend: **238 mocked tests passed** (97 existing endpoint tests and 141 teaching endpoint tests). The existing Starlette/AnyIO warning remains; there was no live OpenAI request.
- New command/runtime coverage includes ordered compound requests, contextual selections and pronouns, strict action validation, missing-amount clarification before mutation, stale interpretation cancellation, whole-request undo/redo, cancellation during playback/narration, noncumulative replay, the eight-action replay limit, and rendered-camera history capture.
- Push-to-talk tests use a simulated recognizer: finish versus cancel, release before startup, final result after release, duplicate transcripts, permission/error handling, ignored stale callbacks and disposal are covered. The provider owns one recognizer across views.
- Anatomy/scene tests cover independent visibility, synthetic-only tissue layers, socket/ligament geometry, original geometry ownership, root/crown movement attachment, fixed supporting tissues, appliance visibility, temporary movement/attachment variations and canonical lesson return.
- The translation lesson uses an authored 1.2 mm mesial displacement. A front-camera projection regression checks that the movement is visible horizontally; root and crown displacement remain equal. Tipping uses the existing illustrative geometric pivot.
- Existing case-format, STL import/calibration, attachment persistence, movement, measurement and stage-export tests remain in the passing suite. Saved case versions are unchanged.

## Browser checks

- Development and optimized production builds were inspected at 1280 × 720 and 390 × 844. The phone layout has no horizontal overflow, shows the labelled cutaway and retains the Stop button. Temporary viewport overrides were reset.
- Compound example: upper jaw + hidden gums + highlighted upper molars + slow palatal demonstration executes in order, reaches the correct movement step, and uses 0.5× speed. Stop interrupts playback; one Undo restores the original case view.
- Contextual group example: `show upper arch and select upper incisors and move them 1 mm buccally` selects and moves all four upper incisors. One Undo restores both arches, the original single selection and zero displacement.
- A compound request with a missing movement amount makes no earlier display changes. The release asks: “How many millimetres should the teeth move?”
- Anatomy entry frames the selected tooth/socket automatically. Root, crown, gingiva, ligament and supporting bone labels are readable. `make the bone transparent and hide the root and hide gums` sets opacity to 25% and removes only the requested tissues and labels.
- Keyboard Ctrl+Z restored both lecture layout and a prior nonfinal timeline stage (7 back to 3).
- Cutaway → Undo → Redo restores the fitted camera with the layers. History waits for the rendered scene, rather than capturing the old full-arch view.
- `compare translation and tipping` starts translation, waits for it, then plays tipping to 100%. `repeat that more slowly` restarts from the saved beginning at 0.5×. Stop during the replay pauses the partial result; Undo restores the preceding 100% result and 1× speed.
- The original overlay includes a stationary root as well as the crown. Free movement and attachment commands show a temporary-variation badge; Return to lesson removes the variation and restores the current step's authored starting setup.
- Requested narration enters the Speaking state and displays the prepared explanation. Stop returns it to Ready. Audio audibility and microphone interruption are covered by controller logic/tests, not a real spoken-hardware walkthrough.
- No JavaScript warnings or errors were recorded in the final production walkthrough.

## Remaining manual checks and limits

- **Actual English speech recognition in Chrome/Edge is not verified.** The user was asked to test hold Space → say “show roots” → release. Simulated tests and typed requests do not establish microphone permission, device operation, vendor availability or recognition accuracy.
- **Live OpenAI interpretation is not verified.** The optional endpoint was tested with mocks; an API key and running Python backend are required for unfamiliar wording. Familiar commands remain local.
- PNG export captures the WebGL canvas and omits HTML tissue labels. Use a screenshot for a labelled slide. This release did not download and visually inspect a PNG.
- New bone, sockets and enlarged ligament are synthetic teaching illustrations. Imported scans receive no generated patient roots or bone. Supporting tissues remain fixed while the tooth moves; no deformation, force, treatment timing or biological outcome is calculated.
- Classroom variations, command history and display settings are temporary and are not added to the case-file format. Existing case save/load and geometry export remain available in the case workspace.
- The included ZIP contains source, optional backend, documentation, sample models and the updated prebuilt static app. API secrets, virtual environments, build caches and dependency folders are excluded.

See [VOICE_CLASSROOM.md](VOICE_CLASSROOM.md) for commands and [TREATMENT_WORKFLOWS.md](TREATMENT_WORKFLOWS.md) for appliance research. The source-linked anatomy lesson uses the [NIDCR teaching guide](https://www.nidcr.nih.gov/sites/default/files/2021-04/Open-Wide-and-Trek-Inside.pdf).

---

# Historical baseline: version 0.4 · treatment workflow classroom

Verified locally on 22 September 2026 with Node.js 24.14.0. Software checks establish application behavior; the demonstrations are authored educational geometry.

## Automated checks

- `npm test`: **580 tests passed in 15 suites**.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npm run build`: successful optimized static Next.js export.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- New coverage checks all three seven-step workflows, installation versus movement, initial/intermediate/final poses, upper/lower isolation, input immutability, dental inclination versus palatal translation, phase commands, direct retention-step routing, appliance visibility, transformed anchor attachment and resource disposal.
- Existing movement, import/calibration, persistence, stage export and simulated speech-controller tests remain in the suite. Backend code is unchanged; no new backend test or live OpenAI request is claimed.

## Browser checks

- Inspected the classroom at 1280 × 720 and 390 × 844. The phone page had no horizontal overflow; the model, command form, numbered steps and question reveal were usable. Reset the temporary viewport override.
- Fixed braces: verified bracket-only fitting, engaged wire and ligatures, directional arrows with stationary crowns, animation through 100%, removal of active appliances, and the schematic lingual retainer in occlusal view.
- Palatal expansion: verified posterior bands, central screw/framework and connecting arms, opposite direction arrows, animated widening and conceptual palate separation, and passive holding with no continued arrows.
- Dental archwire expansion: verified dental buccal directions, pause and scrub to the endpoint, crown inclination, and absence of a split palate or central expander.
- Typed speech-style commands were exercised for starting/switching workflows, appliance installation, activation, movement, retention, views and group selection. `show retention` opens the actual retention explanation, rather than the preceding endpoint review.
- Restart restored the initial geometry and 0% progress. Next/previous controls and question reveal worked; changing a step resets the desktop explanation panel to its top.
- Case isolation: entered workflows after moving tooth 11 buccally by 1 mm in front view. Switching between the three workflows and returning preserved that edit and camera view. One Undo then restored zero displacement. Starting a workflow from the case command field also worked.
- Built release loaded at `http://127.0.0.1:3000/`; opened the workflow library and installed the palatal expander through the command field. The production model, components and explanation rendered correctly.
- No JavaScript warnings or errors were recorded during the development walkthrough or final production check.

## Boundaries

- **Live microphone recognition and handoff between case and workflow remain untested on real hardware.** Typed commands and simulated speech tests do not establish microphone permission, browser-vendor service availability or recognition accuracy. Case recognition is stopped and queued commands cleared on workflow entry; vendor recognition shutdown is asynchronous.
- Each workflow owns a separate synthetic model and leaves the professor's editable case mounted but paused. Workflow controls navigate a scripted example; free tooth editing remains in the case workspace.
- The illustrative endpoints, arrow directions, root shapes and split palate are not calculated biological responses. No force magnitude, tissue response, treatment timing, activation schedule or patient outcome is predicted.
- Research and linked primary/official references are recorded in [TREATMENT_WORKFLOWS.md](TREATMENT_WORKFLOWS.md), with relevant sources also exposed inside each lesson.
- PNG downloads and live OpenAI calls were not exercised in this release. Existing case/STL/ZIP payload verification is recorded in the historical v0.3 baseline below.

---

# Historical baseline: version 0.3 · lecture upgrade

Verified locally on 22 September 2026 with Node.js 24.14.0. Software checks verify geometry and application behavior, not clinical validity.

## Automated checks

- `npm test`: **508 tests passed in 13 suites**.
- `npm run typecheck` and `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: passed.
- `npm run build`: successful optimized static Next.js export, including the final lecture UI.
- `npm audit --omit=dev`: zero reported vulnerabilities. `fflate@0.8.3` is pinned from the official npm registry.
- Coverage includes 100 teaching-command/lesson tests, 24 simulated speech-controller tests, 25 stage-export tests, attachment placement/topology and persistence, old case compatibility, optional attachment visibility, and camera preservation across metadata edits.
- Stage tests cover exact poses, indexed triangles, static gums, attachment transforms, checkpoint order, quaternion interpolation, asynchronous snapshots, manifests, 2–50 stage interval counts, invalid inputs, and the 250 MiB raw batch guard.
- A full case fixture saved/reloaded 28 crowns, 28 schematic roots, two gums, two checkpoints, four movement history entries, and a rotated beveled attachment. The JSON was 17,304,909 bytes; attachment settings and session state matched exactly after reload.
- A real three-stage ZIP was generated through the production export functions, decompressed, and checked. It contained three binary STLs and the manifest; stage 0 and final matched independently generated expected binary meshes byte for byte. Attachment surfaces increased the expected triangle count. ZIP size was 12,032,514 bytes.
- The optional backend was unchanged in this upgrade. Its historical v0.2 result remains 97 mocked tests; no live OpenAI call or new backend run is claimed.

## Browser checks

- Inspected ordinary and lecture layouts at 1280 × 720 and the lecture layout at 390 × 844. All five 3D tools remained visible after layout refinement. The mobile lecture page had no horizontal overflow and its command bar remained in view. The temporary viewport override was reset.
- Direct world-X handle drag produced +3.43 mm on tooth 11; one Undo restored 0.00 mm. A rotation handle produced −23° world-Z; one Undo restored 0°. Attachment geometry followed the tooth.
- Rectangular and beveled attachments were applied to tooth 11, including a 25° angle. Camera framing remained unchanged after appliance edits. An ellipsoid attachment was added to lower tooth 41 through a command.
- Typed speech-style commands `select tooth forty one` and `move it half a millimeter buccally` selected 41 and applied 0.50 mm. Scene commands switched to front view, showed roots, and hid gingiva. Focus on tooth 11 correctly selected only that tooth even with multi-select enabled.
- The translation/tip/torque lesson ran through all six steps in the optimized production app. Next-step text commands, previous-step restoration and restart were verified. Remaining lesson definitions are covered by automated tests; a full browser walkthrough of each is not claimed.
- The 11-stage sequence export completed in the browser without console errors. The embedded browser does not expose generated downloads reliably, so browser initiation is distinguished from the independently verified ZIP payload above.
- Opened a full saved v0.3 fixture in the production app at `http://127.0.0.1:3000/`: transforms, history, two checkpoints, root visibility, and the attachment angle were restored.
- The optimized app loaded the teaching interface and model successfully. No JavaScript warnings or errors were reported in the recorded development/export checks or the final production console check. The release tab was left in lecture mode with the original synthetic study.

Live microphone recognition and the downloaded PNG image remain unverified. Snapshot code captures the next rendered 3D canvas; the surrounding interface and HTML tooth labels are excluded. Existing import, measurement, intersection and older-case regression coverage remains in the automated suite and the historical baseline below.

## Integration and teaching limits

- **Live microphone recognition is untested.** Speech tests instantiate a simulated recognizer. Actual browser support, English recognition, permissions, microphone hardware, browser-vendor speech processing, service/network failures and recognition accuracy remain separate checks.
- Live voice applies supported local teaching commands immediately; Review mode fills the input for manual submission. Live voice is not a verified OpenAI realtime audio integration. Optional AI text interpretations still require an explicit Apply action.
- Exported STLs contain crown and static gingiva surfaces, plus optional configured attachments. They exclude schematic roots, brackets, wires, display-only arch separation and colours. Attachment surfaces are **not Boolean-unioned** with crowns. Neither staged meshes nor attachment geometry implement aligner shells, thickness, trim lines, materials, force systems or fabrication validation.
- The ZIP contains `count + 1` STL files, including stage 0, and a manifest. A raw 250 MiB guard bounds the batch before STL allocation; individual stage export remains useful when the total sequence is too large.
- Guided lessons, arbitrary camera/view changes and PNG snapshots communicate geometric demonstrations. They do not calculate treatment feasibility, tissue response, biological timing or safe movement ranges.
- Public UX references: [dentOne manual](https://www.ezdentone.com/designsoftware-common/), [dentOne tooth controls](https://www.ezdentone.com/faq/), [Smilecloud views](https://learn.smilecloud.com/en/article/design-views), [Smilecloud tooth controls](https://learn.smilecloud.com/en/article/design-library-controls), and [Smilecloud illustrative Motion limits](https://learn.smilecloud.com/en/article/introducing-motion-in-blueprint). These were read for workspace inspiration without logging in or copying assets/code.

---

# Historical baseline: version 0.2

Verified locally on 22 September 2026 with Node.js 24.14.0. The checks below apply to the earlier v0.2 workspace, not automatically to the v0.3 lecture changes.

## Automated checks

- `npm run typecheck`: passed.
- `npm test`: **311 tests passed in 8 suites**.
- `npm run build`: successful optimized Next.js static export.
- `npm audit --omit=dev --audit-level=high`: zero reported production dependency vulnerabilities.
- Backend `python -m pytest -q`: **97 tests passed** using mocked OpenAI responses. One third-party Starlette/AnyIO deprecation warning remains.
- Strict unused-local/parameter checks passed during the integration review.
- Full demo serialization/reload: 28 crowns, 28 schematic roots, two gingiva meshes, two checkpoints, and four history entries preserved. Indexed geometry reduced this fixture from 83,839,200 to 17,304,772 bytes.
- Final STL fixture: 190,240 triangles, 9,512,084 bytes; binary size and transform/export behavior verified. Roots and appliances are excluded.

Coverage includes group target resolution and ambiguous-range rejection; upper/lower direction conventions; fixed-world and tooth-reference quaternion rotations; atomic history; shortest-path stage interpolation; root/crown topology and normals; version-1 compatibility; corrupt-case rejection; bracket attachment; camera frustum fitting; distances and triangle-surface intersections.

## Browser checks

- Loaded the 28-tooth demo with both arches, brackets, archwires, tooth selection, and the movement controls.
- `intrude upper incisors 0.5 mm`: four upper incisors selected, Y increased 0.5 mm. Undo reverted all four in one step; redo restored them.
- `extrude lower incisors 0.5 mm`: four lower incisors selected, Y increased 0.5 mm.
- Applied upper-incisor torque, captured a checkpoint, added a final buccal move, previewed and captured the displayed checkpoint, and played the complete sequence to the final stage.
- Verified ceramic brackets, blue ligatures, schematic roots, and display-only arch separation.
- Picked upper/lower crown-surface landmarks: the reported distance stayed **11.89 mm** when display separation changed from 9 mm to zero.
- Intersection check returned zero for the tested setup. Moving tooth 11 by +5 mm in world X produced the expected **11 / 21** surface-crossing pair; undo restored the previous setup.
- Loaded an actual older version-1 saved case and both expanded and compact version-2 fixtures. Verified restored history, checkpoints, roots, bracket style, and ligature colour; undo worked after reload.
- Imported all 30 supplied STL files: 28 crowns and two gums. Named movement controls were disabled until calibration. Calibrated imported lower tooth 41, then intrusion by 1 mm produced Y = −1 mm.
- Checked full desktop (1440 × 1000), compact desktop, and phone (390 × 844) layouts. Phone layout had no horizontal page overflow; the mobile tooth selector worked. Reset the temporary viewport override afterward.
- Verified upper occlusal framing after the camera fix, including posterior teeth.
- Loaded the optimized production app at `http://127.0.0.1:3000`, expanded all 14 upper teeth, and undid the group. No JavaScript console errors were reported in the production check.

## Integration limits

- Browser-generated download controls were invoked, but the embedded browser did not expose a download event or a resulting file. Actual case/STL payload generation and reload were verified separately through the production functions. Use a regular browser or `START.cmd` for downloads.
- Live microphone permission/speech recognition and live OpenAI requests were not exercised. The service requires the user's own API key; built-in text commands require none.
- A graphics-driver precision warning appeared during development. No WebGL render failure or production JavaScript error was observed.

The application is a local geometric prototype. It does not calculate braces forces, tissue response, biological feasibility, or patient treatment plans. The in-app guide and reference document state the geometry conventions and limits.
