# Handoff — local AI and Professor Nael pitch

**Branch:** `ahmed/phase-3-ai-pitch` · **PR:** pending draft · **Base:** PR #24 at `7bd3eb8` · **Phase:** [3.25](../phases/phase-3-demo-path/3.25-ai-and-pitch.md).

Implemented opt-in app/backend startup and a bounded same-origin loopback gateway. The existing Responses backend, client validation and saved AI preferences remain authoritative. Added 40 focused mocked tests. Independent review caught and verified a Windows environment-casing fix; lesson 43 records it. No private configuration was copied and neither the provider nor local services were contacted for acceptance.

Automated gate passes: 2,901 frontend tests in 153 files, 639 backend tests, typecheck, zero-warning lint, formatting, file limits (522 files), production build and exported-demo checks. Video decode and representative frame checks pass; no listening, live browser or device acceptance is claimed.

Delivered an English narrated 3:45 feature overview at `C:/Users/ahmed/Documents/Codex/Nael-Pitch-2026-09-28/Nael-Teaching-Studio-Pitch.mp4`, plus transcript and manifests. Standalone illustrations use the exact bundled dental model and are visibly labelled. Production source and provenance are in [docs/pitch](../pitch/README.md). No public upload or message to the professor was made.

Next: user chooses the existing OpenRouter/OpenAI-model setup or a direct OpenAI key. Configure only the private backend file, verify a provider request without exposing secrets, and launch the repaired local demo after replacing its known static server. Existing saved opt-outs require an explicit Settings reconnect. Auditor then completes live app/voice/projector/DPR acceptance; the earlier browser security restriction remains binding and no workaround was attempted.

Main was pulled at session start and fetched/merged again before PR creation; already up to date. Dependency locks are unchanged. Existing broad refactor inbox items remain separate. AGENTS and STATUS are untouched. Draft status is required until the remaining acceptance and applicable CI pass.
