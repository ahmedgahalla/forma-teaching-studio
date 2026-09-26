# Tooth study

Teaching draft — pending educator review · synthetic model

Forma can isolate and label any of its 28 permanent teeth, including the roots. This is a synthetic university teaching illustration, not patient anatomy or clinical advice. The root counts describe the model: per upper quadrant **1, 1, 1, 2, 1, 3, 3**; per lower quadrant **1, 1, 1, 1, 1, 2, 2**. Third molars are absent. Real tooth morphology varies.

## Open, view, explain and return

Select exactly one tooth and choose **View → Study this tooth**, or use a typed command. In hands-free mode prefix each command with **Forma**:

```text
show tooth 16
study tooth 16
show me the upper right first molar
show the lower left canine
tooth one six
view it from the mesial
explain this tooth
back to the full mouth
```

The selected tooth is isolated, its roots shown, and gingiva and supporting anatomy hidden. The card shows its formal name and FDI number, model root count and names, crown features and orthodontic relevance. **Explain aloud** reveals the spoken explanation on the card and narrates through the same captioned speech path as lesson explanations. It works independently of optional spoken confirmations. **Stop**, **Escape**, or hold-to-talk interrupts narration. Hands-free recognition pauses while Forma speaks, as described in [ADR 004](decisions/004-hands-free-voice.md).

**Back to full mouth** restores the exact camera, selection, isolation, arch, roots, gingiva, number labels and supporting-anatomy settings captured before the first study opened. Opening a second tooth during the same study retains that original return state. **Undo/redo** restores whole requests, including study and explanation state. Loading another model ends the study. Study state is session-only and is not saved in case downloads.

Closing must be the final action in a combined request. Give subsequent commands separately so they resolve against the restored selection and display.

## Names and directions

Names use the **patient's** right and left. If a side is omitted, it defaults to the patient's right: **upper first molar → 16**, **lower canine → 43**. Say upper/maxillary or lower/mandibular; when an arch is already selected it can supply an omitted arch. Otherwise Forma asks for the arch. Canine/cuspid/eye tooth, premolar/bicuspid and first molar/six-year molar are aliases. First and second positions remain distinct.

| Request after opening a study                                | Tooth-relative view                   |
| ------------------------------------------------------------ | ------------------------------------- |
| `view from the buccal`, `labial`, `cheek side`               | Outer facial surface                  |
| `view from the lingual`, `palatal`, `tongue side`            | Inner surface                         |
| `view from the mesial` / `distal`                            | Toward / away from the dental midline |
| `view from the occlusal`, `biting surface`, `incisal`, `top` | Biting surface                        |
| `view from the apical`, `root tip`                           | Root tips                             |

Use the complete `view from the …` phrase for each alias. Side views keep world superior (+Y) upright. Occlusal and apical views put the buccal side at the top. Projected labels use **Labial** for incisors/canines, **Palatal** for upper teeth, **Incisal** for incisors/canines, and **Apex** for the rootward direction. Labels pointing toward or directly away from the camera are hidden to avoid covering the tooth.

**Turn it**, **next side**, **next/back**, and the presenter keys cycle **buccal → mesial → lingual → distal → occlusal → apical** (Back reverses). Outside study, navigation continues to follow the current workflow, lesson or demonstration. An empty free workspace explains that there is nothing to step through.

`tell me about this tooth`, `how many roots does it have`, and `what is this tooth` request the same authored explanation. With no study open, a single selected tooth is opened first; otherwise Forma asks you to select one. `close tooth view`, `exit tooth study`, and `show all teeth` also close an active study. Existing `focus 16`, `select 16`, `zoom to 16` and `show roots` retain their ordinary meanings.

## Implementation and review limits

Tooth-study actions and their context are local-only; they are removed from the optional interpreter payload. Authored text lives in `src/lib/tooth-anatomy/`, separate from logic. Tests compare all 28 root counts directly with `public/models/forma-teaching-v1.json`. Camera and surface-label math have pure unit tests; scene tests cover restoration and request history.

The model construction in `scripts/anatomy/sculpt_teeth.py` and its metadata are authoritative for depicted branches. General molar descriptions were cross-checked against [University of Al-Maarif dental anatomy teaching notes](https://uoa.edu.iq/storage/uploads/6977312bc82b7_dental-anatomy-lec-11.pdf); this is source checking, not educator approval. The complete authored content still needs review by an orthodontic educator.

The card uses 18 px body text and a 28 px heading, theme tokens, and a separate column beside the model; narrow layouts stack it below. Browser, projector, microphone and DPR 1/2 checks were **not possible in this builder task**. DOM labels, the card and voice captions are not included in the WebGL PNG export; use a screen capture for a labelled teaching slide.
