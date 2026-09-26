# Handoff — 2026-09-26 — ahmed/onboarding-verification

## Completed

- Pulled merged Phase 2 and the status follow-up to `93812d9`; created `ahmed/onboarding-verification` from main.
- Read the complete shared rulebook and the required status, lessons, architecture, folder map, phase, inbox and handoff documents. No application feature work started.
- Aligned fresh PowerShell 5.1/7 sessions to Node 22.23.3 and Python 3.13.3, preserving the older installations. Node was installed from the official Windows archive after checksum verification. Git is 2.49.0.windows.1.
- Completed `npm run setup`; hooks and dependency sync are enabled. Existing ignored `backend/.env` was preserved without exposing its values.
- An old sandbox-owned `backend/.pytest_cache` caused the first lint run to fail and pytest to emit a cache warning. A full-checkout rename was blocked by the active app. Preserved the entire backend under `C:\Users\ahmed\Documents\Codex\.cache\forma-onboarding\backend-before-refresh`, restored its unchanged tracked files from Git, restored its ignored `.env`, and reran setup to create a fresh virtual environment. No old files were deleted.
- Applied and independently verified GitHub `protect-main` ruleset `24035163`: required PR, zero required approvals, initially required `frontend`/`backend` checks from GitHub Actions, no deletion or force pushes and no bypass actors. Merge commits only; automatic head-branch deletion enabled. The current matrix check names are recorded below.
- Root `AGENTS.md` already provides the persistent project instruction requested by the user. It was read, not modified. Builder never pushes main or edits `docs/STATUS.md`; Claude Code audits and merges.

## Verification

| Check                                           | Result                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`                                 | Passed on Node 22.23.3 / Python 3.13.3; repeated successfully after the backend refresh                                                                                                                                                                   |
| `npm test`                                      | 1,575 passed across 51 files                                                                                                                                                                                                                              |
| `npm run typecheck`                             | Passed with incremental checking disabled                                                                                                                                                                                                                 |
| `npm run lint`                                  | Passed with zero warnings after the cache repair                                                                                                                                                                                                          |
| `npm run format:check`                          | Passed                                                                                                                                                                                                                                                    |
| `npm run check:limits`                          | 244 files OK                                                                                                                                                                                                                                              |
| `npm run build`                                 | Passed; mechanics worker bundled and static pages exported                                                                                                                                                                                                |
| Backend `.venv/Scripts/python.exe -m pytest -q` | 470 passed in the fresh Python 3.13.3 environment, no warnings                                                                                                                                                                                            |
| Real browser smoke check                        | Passed on the fresh production build: model rendered; `select upper front six` selected six teeth; Anterior crowding loaded and played; fixed-braces workflow advanced through brackets and typed `insert archwire` to step 3; no captured browser errors |

The browser check was a functional smoke check, not a new six-screen pixel comparison or DPR 1/2 certification. No UI source changed. No live AI, microphone or physical-device acceptance is claimed. The temporary browser tab and local smoke-test server were closed afterward.

After merging `dfd377f`, all seven command checks above were rerun successfully: 1,575 frontend tests, 470 backend tests without warnings, typecheck, zero-warning lint, formatting, 244 files within limits, and the production build. The earlier browser smoke evidence is unchanged; documentation merge resolution did not change the UI.

## Next

- Auditor: review the onboarding PR. PR #9 already updated the external-settings item; the builder handoff is resolved.
- The user supplied a Phase 3 demo planning brief. Prepare a separate docs-only proposal PR after onboarding; no implementation is authorized yet.
- Existing auditor backlog is unchanged: narrower case-view props, Try Mode package split and CSS deduplication.
- PR #3 and the Node/lifecycle follow-ups are now merged. This branch merged latest main (`dfd377f`); onboarding is numbered 1.9 because 1.5–1.7 are taken and open PR #10 reserves 1.8.
- Effective branch rules were rechecked: `frontend (22)`, `frontend (24)`, and `backend` are required. No settings change was needed.
- The next docs-only proposal will record the requested builder sign-off on the Node policy. The proportional-verification proposal in PR #10 is still open and was not treated as an active rule.

## Open questions

None about the builder/auditor workflow. This session verified this computer only; another developer must check their own local runtimes.
