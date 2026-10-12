# Issue #70: choose prompt destination

Source: GitHub #70. Google Docs URL is unset; this change remains unreflected there.

Show current-room versus new-room radio choices for post-analysis coordination and later prompts. Existing API rooms default to current; samples lacking a persistent room default to new and disable current. Current keeps the backend room id, the preceding coordination id for later prompts, and user furniture edits/operations. New clears those identities and edits, creating a separately analyzed room at the same dimensions. The current saved room is retained; successful new results are saved/navigated under their new ids.

Send only the follow-up text: backend already receives preceding prompt and products through base_coordination_id. Repeated concatenation could otherwise exceed the 500-character API limit. Current-room updates produce a new coordination on the same backend room; prior coordination history remains available. New-room uses the entered request, dimensions, and budget without silently inheriting current furniture edits or reuploading photos.

Verify with a controlled local API fixture: current followup GETs the same room, sends preceding coordination id and edits; new followup POSTs a new room without preceding coordination/edit references; saved old record remains unchanged. Frontend lint/build. Live provider interpretation and production are unverified. Offline mode does not offer prompt interpretation, consistent with its capabilities.


2026-10-10: この仕様の画面まわりは `specs/screen-refactor/spec.md` で置き換えた。
