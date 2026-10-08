# Final backlog integration checks

Application revision: `bcc16b27aed1ce847f0242a46382ce1623f381c7`.

The actual UI ran against controlled HTTP fixtures in the existing Chromium browser. No production accounts, provider requests or production writes were used.

- Removing the sole furniture request by keyboard restores focus to Add before paint, with ordinary and reduced motion. Both settled screenshots are included.
- Image furniture offers the six categories accepted by its API; manual mirror placement remains available.
- Initial generation and follow-up failure, pending, stop, retry and immediate success passed. Setup identity/back/focus, mixed photos, removal, object URL release and limits passed.
- Chat cancellation/retry, live reduced motion, single-canvas retention and navigation cleanup passed. The mobile result screenshot is included.
- Complete-model furniture targets preserve exact affine world transforms and exclude cross-owned descendants. Independent review exercised 15 cases using actual OutlinePass selection caches and collision collection; details are in `specs/furniture-overlap/spec.md`.
- Combined mirror GPU checks passed for procedural, loaded-model and complete-room paths with no page errors.
- Frontend lint, typecheck and production build passed. Existing bundle-size warning remains.

JSON results retain the exact revision, stages and expected injected HTTP failures. Dummy sample-photo removal was not reachable through the ordinary setup capabilities and remains unverified; real-file removal was checked. Production authentication, live providers, physical touch and assistive technology remain unverified.
