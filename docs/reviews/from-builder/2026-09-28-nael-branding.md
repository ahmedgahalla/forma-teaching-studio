status: open

# Nael Teaching Studio branding acceptance

**Phase:** [3.24](../../phases/phase-3-demo-path/3.24-nael-branding.md) · **Dependency:** draft PR #23.

Source inventory distinguishes the app's display brand from the voice assistant's supported wake phrase, source asset identity and persistent technical identifiers. The renamed header/loading/classroom/audience surfaces and N favicon use the owner-requested name. Literal glossary/backend display references are updated; mechanics and command behavior are unchanged. Regenerate the binding fingerprint after the loader-message edit, following the existing generated-file rule.

Auditor: check actual header/loading, classroom, browser tab and icon, and audience title at the required screen sizes. Confirm saved cases/preferences and existing “Forma” voice commands still work. Visual checks remain pending because the earlier security rejection prohibits local browser inspection and workarounds. Keep the stacked PR draft until acceptance and applicable CI are complete.
