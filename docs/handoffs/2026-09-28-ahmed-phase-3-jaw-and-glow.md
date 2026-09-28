# Handoff — Claude jaw control and selection glow

**Branch:** `ahmed/phase-3-jaw-and-glow` · **PR:** [#26 (draft)](https://github.com/ahmedgahalla/forma-teaching-studio/pull/26) · **Base:** PR #25 at `867fd9e` · **Phase:** [3.26](../phases/phase-3-demo-path/3.26-jaw-and-selection-glow.md).

Added the Atlas-authored 14° lower-jaw display hinge with Open/Close controls in Explore Display and Lecture View, plus matching local typed/spoken commands. Saved states, Undo and lecture return retain it; legacy saves default closed. Displayed lower anatomy and appliances follow the same hinge, while picking/gizmo commits recover the original case coordinate frame. Gum deformation removes the rigid hinge before following individual tooth poses. Source geometry and mechanics data remain unchanged.

Replaced the former blue/teal selection outline with Claude's additive Fresnel surface glow, preserving enamel appearance and sharing existing geometry. Isolation/visibility, multiselection and root controls remain supported. Source hashes and implementation limits are recorded in asset provenance and the phase doc.

Automated verification passes: 2,950 frontend tests in 159 files, 639 backend tests, typecheck, lint, formatting, limits, build and demo asset check. Earlier security review blocks local-browser inspection/workarounds; no GPU, DPR 1/2, voice-device or projector acceptance is claimed. The existing local port 3012 preview serves the rebuilt export; the user must refresh its already-open page. No provider was activated; direct OpenAI versus the saved OpenRouter setup remains pending from the preceding task.

Main was pulled at session start; no dependency changes, new size exceptions, AGENTS edits or auditor-owned STATUS edits. Broader auditor refactors remain separate. Next: auditor checks jaw/selection behavior in the actual app and completes the prepared-case/braces/typed-command journey before merging this draft stack.
