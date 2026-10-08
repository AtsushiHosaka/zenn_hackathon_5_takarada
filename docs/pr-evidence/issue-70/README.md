# Issue #70 browser evidence

Captured on 2026-10-09 from the issue branch running locally. These are actual rendered UI screenshots against intercepted API fixtures, not production or real-database evidence.

- `current-room.png`: the default current-room modification target.
- `new-room.png`: explicit new-room generation target.
- `mobile-new-room.png`: target and send controls visible at 390×844.

Browser interactions verified that current-room modification fetched room 41, then created coordination 102 for the same room with base coordination 101 and retained furniture edits. It did not create a new room. New-room generation created room 42 and coordination 103 with no base coordination or original edits, and used only the new instruction. The local saved coordination 102 JSON remained unchanged after creation of coordination 103. The list linked to both saved results.

Empty submit was disabled. A 500-character message combined with the existing prompt was rejected before any network request. Room-list preview rendering showed a fallback during repeated fixture navigation; only list links were verified. No real backend, database, Gemini, EC provider, or deployed-host verification is claimed.
