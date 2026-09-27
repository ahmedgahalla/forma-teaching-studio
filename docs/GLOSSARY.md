# Teaching glossary

Forma has 40 authored teaching definitions for classroom explanations. Every entry carries **Teaching draft — pending educator review**; the definition card also identifies the synthetic model. Educator or clinical review has not occurred. These descriptions and demonstrations provide no clinical advice, force values, treatment recommendations or patient-specific predictions.

## Ask Forma

Type a phrase in the command bar, or use the voice controls with a leading “Forma” wake phrase:

- “What is the cusp of Carabelli?”
- “What's torque?”
- “Explain tipping.”
- “Define mesial.”
- “What are mamelons?”
- “Tell me about the periodontal ligament.”
- “Show me the oblique ridge.”

Forma changes the visual first, then displays and narrates the definition. Related-term buttons run the same validated requests. Close the card with its button, “close the definition”, or “hide that”. Closing the definition leaves its visual available for discussion; Undo restores the complete previous request, including the visual and definition state. Stop or Escape interrupts narration.

Definitions use the shared narration captions. When speech output is unavailable, the caption continues in readable chunks with the note “Speech unavailable — showing text”.

## Content and visuals

| Group                                    | Terms                                                                                                                               | Representative visual                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tooth directions and surfaces            | Mesial, distal, buccal, labial, lingual, palatal, occlusal, incisal                                                                 | A relevant surface of tooth 11, 16 or 46 in tooth study                  |
| Crown and root anatomy                   | Apex, cervical line / CEJ, cusp, cingulum, mamelons, marginal ridge, oblique ridge, fossa, cusp of Carabelli, furcation, root trunk | Tooth 11, 13 or 16 in tooth study                                        |
| Supporting structures and identification | Periodontal ligament, alveolar bone, FDI numbering                                                                                  | Schematic anatomy layers or tooth 16 with its FDI identity               |
| Occlusal relationships and spacing       | Overjet, overbite, crossbite, open bite, deep bite, crowding, diastema                                                              | An existing prepared case at its starting frame                          |
| Molar classification                     | Angle Class I, Angle Class II, Angle Class III                                                                                      | Definition only; no new authored visual is selected                      |
| Movement and maintenance                 | Anchorage, translation, tipping, torque, rotation, intrusion, extrusion, retention                                                  | An existing prepared case with its matching variant, paused at the start |

There are 37 entries with visual sequences. Views identify a representative tooth or relationship; they do not certify that every named anatomical feature is separately resolved or labelled in the synthetic geometry.

- **Carabelli:** opens tooth 16 from the palatal side. Tooth-study actions use the canonical `lingual` view, displayed as palatal for an upper tooth.
- **Anterior surfaces:** the canonical `buccal` and `occlusal` tooth-study views display as labial and incisal for anterior teeth.
- **Translation, tipping, torque and rotation:** open `movement-types` with `translation`, `tip`, `torque` or `axial-rotation`, respectively. These are authored geometric changes, not calculated biological responses.
- **Intrusion and extrusion:** select the existing anterior-intrusion deep-bite example or anterior-extrusion open-bite example. Their inclusion explains the movement term and does not recommend either approach.
- **Periodontal ligament and alveolar bone:** load the full `reference-occlusion` case, show roots and hide gums before enabling the relevant schematic layer. This deliberately exits tooth study, whose isolated display suppresses anatomy layers. Alveolar bone uses the authored display opacity of 0.25; that is a rendering setting, not a tissue measurement.
- **Angle classes:** no separate glossary visual is authored. The definitions describe first-molar relationships and distinguish them from conclusions about skeletal relationships or overall alignment.

## Local lookup and review boundary

Content lives in `src/lib/glossary/`, separated into anatomy, occlusion and mechanics data. Each entry has an ID, term, aliases, one or two definition sentences, related IDs, a shared review status and an optional existing TeachingAction sequence.

Lookup is deterministic: it normalizes case, spacing and hyphens, then matches an authored term, ID or alias exactly. Examples include “cusp of karabelli”, “singulum”, “tork”, “CEJ” and spoken “Angle Class two”. Forma does not guess a near match.

Definition requests use “what is”, “what's”, “what are”, “define”, “explain” or “tell me about”. “Show me” selects a glossary explanation only when it names a known glossary term; existing display and tooth-study commands keep their precedence. An unknown definition request returns a local clarification with example terms. It does not call the AI interpreter, including when AI interpretation is preferred. The separate optional Analyze path retains its existing behavior.

The `glossary` action is local-only. External interpreter plans cannot supply it, and glossary state and local-only action history are removed from AI context. Authored visual sequences and their definition action execute as one undoable request. Every visual sequence is validated against a representative free workspace, and explanations are also tested after an existing tooth study.

Definitions, lookup, visual plans and caption fallback work without the AI service. Browser speech recognition has its own availability and service requirements; the local glossary does not make the browser's recognition service offline. Typed requests remain available.

## Reference material and remaining review

The draft terminology was checked against these published educational references and the existing Phase 4.2 tooth-anatomy content:

- [American Association of Orthodontists: glossary of orthodontic terms](https://aaoinfo.org/resources/glossary-of-orthodontic-terms/) — general orthodontic, surface and occlusal terminology.
- [Dentalcare: An Overview of Dental Anatomy, glossary](https://www.dentalcare.com/en-us/ce-courses/ce500/glossary) — anatomy terms including the cementoenamel junction, cingulum and periodontal ligament.
- [Dentalcare: Anomalies of Tooth Structure, accessory cusps](https://www.dentalcare.com/en-us/ce-courses/ce651/accessory-cusps) — the location of Carabelli's feature on upper molars and its prominence on first molars.

These source checks do not constitute educator approval of Forma's wording, representative views or synthetic geometry. An educator should review the definitions and demonstrations together before using them as assessed course material. Root counts and tooth-specific tour descriptions follow the existing synthetic-model content; human anatomy varies. See [Phase 4.2](phases/phase-4-voice-lecture-assistant/4.2-tooth-study.md), [the professor guide](PROFESSOR_GUIDE.md) and [voice controls](VOICE_CLASSROOM.md) for the related teaching workflow.
