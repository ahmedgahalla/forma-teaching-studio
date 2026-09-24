# Test Forma on your phone

Open https://forma-teaching-mobile.ahmedgah123.chatgpt.site in your phone browser and sign in with the same ChatGPT account used to publish the private site. It works across mobile data and different Wi-Fi networks. Version 0.12, including online AI, was published on 24 September 2026.

## Quick test

1. Wait for the synthetic 28-tooth model to load; landscape gives more space.
2. Type `select upper front six`, then `install brackets here`.
3. Try `show roots and hide gums`, a small supported movement, and `undo that`.
4. Use flexible wording to exercise online AI. Clear commands are handled locally first; ambiguous instructions request clarification.
5. Try the on-screen Hold to talk button if your phone browser supports speech recognition. Actual mobile microphone behavior still needs testing.

The phone discovers the authenticated same-origin AI service automatically. If you previously disabled AI in this phone browser, enable it in Settings. The service URL is the same URL as the app. Never enter an API key on the phone.

## Temporary AI connection

The host computer, local backend, phone bridge and tunnel must remain on. The OpenRouter key remains on that computer. The private Site stores a separate bridge credential as a server secret; it is never sent to the browser. Only command text and minimal scene context go through this connection. No file, mesh-upload or arbitrary proxy route is exposed.

Stopping the computer or tunnel disconnects online AI; built-in commands and loaded models continue working. Restarting the temporary tunnel requires updating the bridge URL in Sites and redeploying its environment revision. This is a test connection, not a permanent independent backend.

## Verification

- Production build and TypeScript passed.
- Frontend: 1,476 tests / 47 files passed.
- Python backend: 363 tests passed, including 28 phone-bridge tests.
- Private gateway: six tests passed for identity, origin, routing, body bounds, credential isolation and offline responses.
- Live gateway code -> HTTPS tunnel -> authenticated bridge -> existing Python validation -> OpenRouter: `Show roots and hide gums` returned the two expected actions. Unauthenticated tunnel access returned 401.
- Sites confirmed publication succeeded with environment revision 1. Physical phone, touch and microphone testing remain unverified; publication success is not an end-to-end phone test.

## Published identity

- Site: `appgprj_6ab39ed0b82881919f49cba3045245ce`
- Version: `appgprj_6ab39ed0b82881919f49cba3045245ce~appgver_c119ebf311748191a2842ced03aa36c0`
- Deployment: `appgdep_6ab4d3c6ea008191af7875d15f23c0f1`
- Site source commit: `95abf5fbf27398b64191cafd7ee983fb74177f3c`

Keep this Site identity and owner-only access. The hosted Worker source is maintained in the separate `../forma-mobile` Site checkout. See [backend setup](../backend/README.md) and [conversational commands](CONVERSATIONAL_COMMANDS.md).
