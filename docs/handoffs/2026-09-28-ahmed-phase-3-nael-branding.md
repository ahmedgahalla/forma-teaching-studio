# Handoff — Nael Teaching Studio

**Branch:** `ahmed/phase-3-nael-branding` · **PR:** pending draft · **Base:** PR #23 at `1e166f9` · **Phase:** [3.24](../phases/phase-3-demo-path/3.24-nael-branding.md).

Renamed the app's visible brand to Nael Teaching Studio, after Professor Nael: header, loading screen, workflow classroom, browser/audience titles, N favicon, launcher and relevant explanatory/error copy. The voice assistant's “Forma” wake phrase and examples remain supported. Technical identifiers, source asset provenance and saved-state formats are unchanged. The existing external mobile deployment was not republished.

Main was pulled at session start and fetched/merged again before PR creation; already up to date. Dependency locks match the previously verified installation. Automated gate passes: 2,861 frontend tests in 151 files, 639 backend tests, typecheck, zero-warning lint, format, file limits (518 files), production build and exported-demo asset check. Exported title/loading name, favicon and bindings were checked directly on disk; the existing port 3012 preview serves the new build.

The gum-binding generator ran after formatting. Its new checksum is recorded in the asset provenance file; independent binary comparison confirms only its generator fingerprint changed, with identical numeric payload and other header fields. No new lesson or unrelated inbox refactor was introduced. AGENTS and STATUS remain untouched.

Next: auditor checks the name and icon on actual desktop/phone/projector screens, including DPR 1/2 and the existing prepared-case/braces/typed-command journey. Earlier security review blocks local browser inspection and workarounds; keep this stacked PR draft until acceptance and applicable CI are complete.
