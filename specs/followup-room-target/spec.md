# Follow-up prompt target (#70)

Source: GitHub issue #70, read on 2026-10-09. `docs/project.md` has no Google Docs URL; the issue and existing coordination contract are the provisional specification. Google Docs has not been verified or edited.

## Acceptance criteria

- Subsequent prompts offer an explicit choice between modifying the current room and generating a new room. Modifying is selected by default.
- Modifying reuses the backend room ID and passes the current base coordination, furniture operations, additions, and edited furniture. The previous request and the new instruction form the request used for the next coordination.
- Generating a new room creates a distinct backend room, with the same dimensions and any available input photos. Its request consists of the new instruction. It does not pass the original room ID, base coordination, or furniture edits and operations. The original room and its saved design remain intact.
- The target selector also appears when requesting a coordination for an analyzed room. A fresh room receives default furniture decisions rather than operations referring to the original analysis IDs.
- The combined request is limited to the existing 500-character coordination contract. An oversized modification shows an actionable error and does not enqueue generation.

## Boundaries

API and database contracts are unchanged. Backend coordinates are immutable proposal versions grouped by backend room ID; modifying creates a proposal for the same room, while the new target creates a separate room. Samples have no backend identity, so the first request materializes a saved room. Offline dummy mode does not implement prompt-based coordination and continues to say so.

No new tests are added, following AGENTS.md. Validation uses frontend lint, type checking/build, and browser interaction with explicit evidence boundaries. Live Gemini and real provider generation require separate verification.
