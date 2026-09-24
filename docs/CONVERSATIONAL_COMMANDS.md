# Conversational classroom commands

Use the same command bar for typing and push-to-talk. Hold Space outside an editable field, or hold the microphone button; release to submit. Pointing identifies a visible location and does not end microphone capture. Stop or Escape cancels pending work and narration. **Undo** restores the complete previous request, including its appliance setup.

Clear validated voice/text movements execute immediately. To inspect a geometric ghost first, start with **preview**. Manual numerical controls retain their preview/apply workflow.

## A first wire experiment

Start in the synthetic free workspace and choose the visible wire preset. Give these requests separately:

1. `Select upper anterior teeth`
2. `Install brackets on them`
3. `Put a wire through these brackets`
4. `Activate the wire by 0.05 mm`
5. `Show what happens`
6. `Show the roots and explain that movement`

Bracket installation and a passive wire do not move teeth. Wire activation is a change to its unloaded transverse width, not a requested biological movement. The solver can reject a setting outside its ideal elastic model or a sampled path with new crown crossings. Its numerical input bounds are software bounds, not clinical prescriptions.

Once a valid response exists:

- `Use a 0.5 mm wire instead` replaces the existing round-wire diameter and recalculates against the same unloaded reference.
- `Make that 0.4 instead` replaces that dimension in millimetres; it does not add 0.4 mm.
- `Use a beta titanium wire instead` changes the material preset and recalculates.
- `Use a 0.019 by 0.025 inch wire instead` selects a rectangular section. Dimensions are stated as **height × width**, matching the wire preset labels: height 0.4826 mm and width 0.635 mm.
- After a rectangular-section edit, specify both dimensions again. A bare `Make that 0.5 instead` asks which dimensions you intend.
- `Set the wire torque to 3 degrees` sets relative end-twist activation. It is supported only with a rectangular section that fits the ideal slot.
- `Use a thicker wire` asks for the actual size. It never invents a thickness or substitutes a force.

The visible preset controls a newly created wire. Existing-wire edits control the focused wire. When several wires exist, choose the intended one in the inspector before saying “that wire.”

## Pointing and TAD connections

Point to a synthetic location, then say `Put a TAD here`. The anchor is placed at the actual marker. It is an ideal fixed teaching anchor; the model does not determine whether that location would be suitable clinically.

A gingiva marker retains the nearest tooth as its reference. `Install brackets here` uses that tooth, or its highlighted group; a TAD still uses the actual marked location.

With brackets installed on the selected teeth:

`Connect the TAD to these teeth at 1 N`

For a group, **1 N means total specified tension**, divided equally into individual tooth connections. Each connection uses that tooth’s installed bracket point. An unbracketed tooth requires an explicit pointed attachment. A spring connection requires one tooth and explicit spring parameters through the inspector.

- `Set the elastic tension to 0.5 N` replaces the focused connection’s tension.
- `Show what happens` calculates the coupled configuration.
- `Compare it without the TAD` calculates an alternative without that anchor and its connected elastics, using the same reference. It does not erase the main experiment.
- `Remove the TAD` removes that anchor and its connected elastics in one reversible change.

Forces use N. The explicit unit `gf` is also understood: 1 gf = 0.00980665 N. Bare grams are not interpreted as force. No unspecified force is supplied unless an elastic preset is visibly selected.

## Expansion, anchors and stages

Use the appliance inspector to create an expander, or give a fully specified engineering setup:

`Install a palatal expander on upper molars with activation 0.1 mm and stiffness 10 N/mm`

This specifies a virtual appliance, not a clinical activation protocol. Optional `and palate stiffness 20 N/mm` adds a declared schematic compliance. Then:

- `Activate the expander to 0.2 mm` replaces its activation.
- `Fix upper molars mechanically` establishes ideal mechanical anchors.
- `Release upper molars mechanically` restores their virtual elastic supports.
- `Save experiment stage as Initial activation` records the current configuration.
- `Show experiment stage 0` recalls the first saved stage. Recall a stage as its own request, then give instructions for that setup.

Stages describe appliance configurations. Every calculation uses the unchanged unloaded reference. Playback speed controls presentation; it does not represent treatment duration or remodeling.

## Direct geometric exploration remains available

- `Move upper anterior teeth buccally 0.5 mm`
- `Move selected segment posteriorly 1 mm`
- `Intrude teeth 11,21 by 0.5 mm`
- `Rotate selected teeth 5 degrees`
- `Preview move selected teeth buccally 0.5 mm`
- `Make that 0.25 instead` revises the last numeric geometric edit in its existing unit.
- `Lock upper molars`
- `Show roots and hide gums`
- `Show original positions`
- `Repeat that more slowly`
- `Stop. Undo that.`

Anatomical directions do not depend on the camera. A segment transformation and a set of individual anatomical transformations remain different operations. Editing a tooth arrangement changes the geometric experiment; an appliance does not silently become a treatment planner.

## Dental-class starting arrangements

Load each as a separate request:

- `Load dental Class I`
- `Load dental Class II division 1`
- `Load dental Class II division 2`
- `Load dental Class III`

These are synthetic dental arrangements, with their assumptions and initial geometry checks displayed. They do not establish a skeletal classification. “Load Class II” asks for the intended division.

## Interpretation and verification

Known commands run locally. The optional server-side AI can interpret supported classroom wording; both the backend and frontend independently check targets, explicit values, visible presets and available objects. No mesh, API key or patient identifier is included in the interpretation request. The frontend checks scene revisions so an old response cannot change a newer scene.

Typed commands and ordinary manual controls remain available when speech or AI is unavailable. Actual microphone accuracy depends on browser support and permission. Automated tests cover parsing, compound references, replacement, atomic undo, asynchronous cancellation and independent provider validation. They do not establish real microphone recognition, projector usability, faculty approval or clinical validity.

The mechanics calculations illustrate initial elastic response under declared engineering assumptions. They do not calculate growth, biological remodeling, force decay, treatment time, patient-specific safety or treatment success.

## Clear response replay and AI conversation (24 September 2026)

The command bar now offers **Ask AI** when a service is configured. Switch it on to send ordinary classroom requests through the actual interpreter, including wording the local parser could already handle. The **AI reply** label appears only after a provider response passes frontend validation. Provider errors do not silently execute a different local command. Stop, Undo and Repeat remain local and responsive. Default mode still uses built-in commands first.

Natural activation wording such as `Could you activate that wire by half a millimeter, then show me what happens?` retains the explicit amount and units. Missing values still request clarification.

Each mechanics calculation chooses a bounded display scale up to 50×, reveals the unloaded reference ghost and displacement traces, and animates for eight seconds at normal speed. The viewport shows the **actual**, unscaled maximum displacement and rotation beside the scale label. The calculation and saved geometry are unchanged. Zero responses remain zero. Use the existing movement-display control to override the scale, and Replay response / Focus selection in the appliance panel for close-up explanation.

A replacement followed by `then show me what happens` recalculates once from the unchanged reference. Example: `Use a 0.018 inch wire instead, then show me what happens.`

[Watch the 81-second full-screen AI demo](https://forma-teaching-mobile.ahmedgah123.chatgpt.site/demos/forma-ai-demo.mp4) (same private sign-in). It includes actual typed AI requests and replies, passive appliance placement, activation, replay and local Undo.
