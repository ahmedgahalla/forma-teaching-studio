# Forma 0.12 · workspace controls

Forma opens in **Midnight Lab**, with dark graphite panels and a mint action color. Use the moon/sun button in the header to switch to **Clinical Studio**, a bright classroom theme. The preference stays in this browser when browser storage is available. Changing theme preserves the camera, selection and geometric arrangement.

## Find the controls

- **Desktop:** Select and Layers open a drawer from the narrow left rail. Tools shows or hides the editing inspector on the right. Close unused tools to give the model more room.
- **Command bar:** the composer stays pinned beneath the model. It shows up to four examples relevant to the current context, with Stop and Undo nearby. Camera presets sit in their own row outside the model image. Unused stage bars stay hidden.
- **Phone/tablet:** Model, Select, Layers and Tools remain in the bottom dock. Selection and editing open in compact sheets that retain space for the model and composer. Stop stays available.
- **Lecture mode:** use the presentation icon for the professor console: model, playback, prediction/question and reveal. Free exploration uses a compact lecture console. Wide displays put the explanation beside the model; on small screens, the question/explanation area is collapsible and Reveal opens it automatically. Use the same presentation icon to exit.
- **Measure versus Analyze:** the inspector's **Measure** tab contains geometric measurements and surface checks; it was previously labelled Analyze. **Analyze** in the command bar asks the AI about the current scene without editing it.
- **Workflow classroom:** the same appearance preference applies to the model, anatomy controls, explanations and library.

## Try the preview controls

1. Type `select upper front six`.
2. Type `preview move the selected segment posteriorly 0.5 mm`.
3. Inspect the cyan candidate and the sampled path report. The fixed decision bar remains visible with Tools closed.
4. Choose **Modify** to open the editing controls and full report, **Discard** to keep the current arrangement, or **Apply** when enabled.
5. Type `undo that` after applying to restore the request's starting state.

The bar uses the same lock and collision eligibility as the editing panel. A blocked or incomplete path check does not become an accepted edit because the interface changed. The existing explicit unrestricted-illustration option remains in the detailed preview panel; locked teeth stay locked.

Clear validated voice/text moves execute immediately in v0.12. The `preview` prefix and manual numeric tools keep Apply/Discard review available. Stop and whole-request Undo remain accessible.

On small screens, creating a preview with the manual controls closes the editing sheet so the model and decision bar can be inspected. **Modify** reopens the sheet with the pending edit; **Apply** and **Discard** remain in the decision bar.

## Appliances and calculated response

Open **Appliances** to find **Build an experiment**. The first section installs brackets, connects the selected bracket set and sets wire material, cross-section and activation. Expand the TAD/elastic or palatal-actuator section for those families. Point at the model before placing a TAD; the marker is an explicit graphics location, not an anatomical suitability assessment.

Use **Show what happens**, **Predict before reveal**, **Movement display** magnification, and **Experiment stages** to compare configurations. Values remain at actual geometric scale even when the picture is exaggerated. Each calculation uses the same unloaded reference; it is not an accumulated treatment stage. Authored appliance illustrations and appearance remain in a separate expandable section.

The command context strip identifies the focused appliance and shows the wire preset after brackets have been installed. Hold Space to speak and release to submit; pointing can update the target during capture. Escape/Stop and loss of focus discard unfinished speech. Settings connects only a backend URL; API credentials stay in the backend environment. See [conversation examples](CONVERSATIONAL_COMMANDS.md) and [provider setup](../README.md#optional-openai-or-openrouter-service).

Try `put brackets in top`, `put brackets in bottom`, or `put a wire on the top teeth`. Top/bottom dental groups resolve to upper/lower locally and through AI. Unfamiliar wording can use the AI interpreter; missing targets, amounts and required constraints still ask for clarification.

## Device checks still to perform

See the [v0.12 acceptance matrix](RELEASE_CHECKLIST_0.12.md) for completed automated checks. The release owner records final browser checks there; the following still require a current device/browser pass rather than assuming an earlier release's result applies:

- Switch both themes; check anatomy, labels, dialogs, numeric controls and preview contrast.
- Test portrait and landscape phones, including short screens and the on-screen keyboard.
- Preview from the command bar with Tools closed; open Modify; verify decisions remain reachable.
- Change a theme and open Select/Layers while a demonstration plays; confirm its camera and progress stay intact.
- Try projector readability, zoom, touch orbit and actual microphone capture.

Initial-mechanics experiments are educational engineering calculations, not treatment predictions. Existing geometric tools and version-1/version-2 case imports remain supported; new version-3 files can retain experiment and lecture settings.
