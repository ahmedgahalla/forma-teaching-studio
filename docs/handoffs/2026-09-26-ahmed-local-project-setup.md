# Handoff — 2026-09-26 — ahmed/local-project-setup

## Completed

- Fast-forwarded the existing local `main` to `cac430b`, Naser's merged Phase 1 tooling PR.
- Created the dedicated checkout at `C:\Users\ahmed\Documents\Codex\Forma`, with the same GitHub origin. Future development should use this folder; the dated copy remains for the existing demo.
- Fetched Naser's open Phase 2 refactor as `origin/naser/phase-2-refactor`. PR #2 remains unmerged; the setup branch starts from stable `main`.
- Added the shared pull / branch / PR workflow in Phase 1.5. Local Git is configured for fast-forward-only pulls and pruning removed remote branches.
- Copied the existing backend configuration locally without displaying its values, and confirmed that Git ignores `backend/.env`.
- Organized the existing Codex task under a Forma sidebar section. Registering the folder as a saved Codex project is a separate UI step.

## Verification

- `npm run setup`: completed with Node 24.14.0 and a fresh Python 3.13.3 `backend/.venv`; dependency hooks and blame-ignore configuration are enabled.
- `npm test`: 1,599 passed across 51 files.
- Backend `.venv/Scripts/python.exe -m pytest -q`: 531 passed.
- Typecheck, lint (zero warnings), formatting, and file limits: passed.
- GitHub authentication restored for `ahmedgahalla`; authenticated push dry-run succeeded.
- `backend/.env`: confirmed ignored and excluded from the changes.
- `npm run build`: blocked at the mechanics worker bundler because the Windows sandbox denies access to the parent directory `C:\Users\ahmed`, including after a read-permission grant. No successful local production build is claimed. CI must pass before merge.
- No browser regression check was performed: the changes are documentation only, and the new local production build is blocked as above.

The initial frontend run had one metadata hash failure because the fresh checkout contained CRLF metadata despite its LF attribute. Normalizing the local metadata to the repository's LF bytes fixed it without a tracked asset change; the full frontend suite then passed. This matches existing lesson #6, not a new geometry defect. Git's normalized diff contains only the intended documentation changes.

For sandboxed setup, npm and pip caches were directed to `C:\Users\ahmed\Documents\Codex\.cache\npm` and `.cache\pip` using process environment variables; the default user npm cache was not writable. Git uses OpenSSL locally because Windows credential acquisition through schannel failed in this environment. No global Git settings were changed.

## Next

- Continue development in the Forma checkout, using `ahmed/...` branches and PRs.
- Auditor: review this documentation-only PR and the existing Phase 2 PR under the shared merge rules.
- `docs/STATUS.md` still describes PR #1 as pending despite its merge. The auditor owns the status update; the builder did not edit it.
- Existing hosted/mobile deployment and running demo services were not changed.

## Open questions

None about the collaboration workflow. GitHub protection settings remain as documented in the auditor-owned status file; they were not changed here.
