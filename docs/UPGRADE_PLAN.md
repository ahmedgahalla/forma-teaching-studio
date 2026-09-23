# Braces workspace upgrade

User objective: improve the dental application, especially the 3D model and the full range of tooth movements used when discussing braces, using credible orthodontic resources.

## Acceptance evidence to collect

- Improved distinct crown geometry for all tooth classes; both arches, correctly opposite upper/lower intrusion and extrusion, schematic roots with clear provenance.
- Brackets attached to teeth, continuous archwire visualization that follows the staged tooth poses, appliance display options. Explain visual setup versus force simulation.
- Translation in all anatomical and world directions; tip, torque, and long-axis rotation using calibrated reference axes. Explicit pivot/sign conventions.
- Commands targeting one tooth, a selected group, explicit FDI lists, arches, or anatomical groups. Group changes must be atomic and undo as one action.
- Multi-selection, arch visibility, comparison, meaningful geometric measurements and surface-intersection checks.
- Editable planning checkpoints, playback through those checkpoints, persistent case/history/scene settings, robust legacy case import and final STL export.
- Updated optional AI parser for the same command schema, with proposals reviewed before applying.
- Source-linked in-app movement guide, credible references, no unlicensed textbook/model assets or claims of clinical validation.
- Automated checks for transforms/parser/geometry/persistence; actual browser checks including file workflows and responsive layout; production package and working local runtime.

These are software visualization requirements. Clinical force prediction, patient treatment selection, and biological safety cannot be established from crown meshes or books alone; the interface must not imply otherwise.

## Current baseline

Version 0.1 was a single synthetic upper arch with basic single-tooth commands, linear stage interpolation, file saving, and an optional text interpreter. Earlier verification established 72 frontend and 36 mocked backend tests.

## Version 0.2 result

The upgraded workspace implements both arches, distinct procedural tooth classes, schematic roots, moving appliances, individual/group anatomical translations and rotations, comparison, surface landmarks, final surface-crossing checks, captured/removable planning checkpoints, saved movement history, legacy case loading, and the expanded optional AI command schema. The source-linked movement guide explains reference axes, signs, pivots, and the difference between geometry and clinical mechanics.

Current verification is recorded in [VERIFICATION.md](VERIFICATION.md): 311 frontend tests, 97 mocked backend tests, successful production build, and real browser checks. Live voice/OpenAI and embedded-browser download limitations are explicitly recorded there. The packaged source includes the static build, setup instructions, references, and 30 segmented example STL files.
