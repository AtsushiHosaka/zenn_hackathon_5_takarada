# Room photo limits and upload feedback

Source: GitHub issue [#65](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/65), retrieved 2026-10-09. `docs/project.md` has no Google Docs URL; the issue and existing upload contract are the provisional requirements. Google Docs remains unverified and unchanged.

## Purpose and acceptance

- Show the existing upload limit before photo selection: JPG, PNG or WebP; at most four files; at most 10,485,760 bytes per file. This matches `RoomPhoto::MAX_BYTES`, `MAX_COUNT` and `CONTENT_TYPES` in `backend/app/services/room_photo.rb`.
- Reject files above that exact byte limit with a capacity-specific message and the affected filename. Empty files and unsupported formats have separate messages. Files exactly at the limit remain valid.
- Preserve confirmed server errors. Signed upload failures show the filename, HTTP status and the storage error code when available. Explain recognized storage codes; do not infer expiration from all HTTP 403 responses or size overflow from an unknown failure.
- Distinguish timeout/cancellation from a network failure. Browser network failures cannot identify the underlying transport or CORS cause, so the message states that limitation and gives a retry action.

## Implementation decisions

GCS error code meanings and XML response shape were checked against the [official Cloud Storage XML error reference](https://docs.cloud.google.com/storage/docs/xml-api/reference-status) on 2026-10-09.

The frontend shares photo validation and visible limit text in `domain/roomPhoto.ts`. Both current signed upload and legacy request validation use it. Direct storage responses may be GCS XML or local adapter JSON; known errors retain their actual codes or messages. No API contract, storage limit, DB schema or iOS changes are required.

## Verification

Existing frontend lint/build and browser checks are recorded in the PR. Browser fixtures establish rendering and client behavior, not a production GCS upload. The original report's root cause remains unconfirmed; this change does not assert that large images caused it. No new tests were added, following AGENTS.md.

### Completed checks

- `npm run lint` and `npm run build`: passed. Build retains the existing bundle-size warnings.
- Actual Chromium, local frontend with intercepted API responses: requirements visible; 10,485,761 bytes rejected with filename and capacity reason; exactly 10,485,760 bytes accepted by client validation; empty file and GIF rejected; valid tiny PNG accepted.
- Signed PUT fixture: XML `AccessDenied` / HTTP 403 shows filename, confirmed access reason and code. Unknown HTTP 500 shows the status and states that the detailed cause cannot be confirmed, without claiming size overflow.
- Desktop 1440×1000 and mobile 390×844 screenshots inspected. Alerts remain visible; the mobile document has no horizontal overflow (`scrollWidth: 390`). Evidence is saved under `docs/pr-evidence/issue-65/`.
- Not verified: live backend, production GCS, Gemini/provider processing or the original failure report. The exact-limit fixture verifies file metadata validation, not decoding/uploading a real image at that size.

## Bounded error responses

Signed-upload error bodies are read from the response stream with a 16 KiB limit before JSON/XML parsing. Larger bodies cancel the reader and use the confirmed HTTP-status fallback; their truncated content is never parsed as a storage error. Confirmed local JSON messages are trimmed and capped at 500 characters. XML error codes retain their existing 80-character allowlist. Network, cancellation and timeout messages remain distinct, and an unknown failure does not claim a photo-size error.

Frontend lint/build passed for this followup. A temporary VM harness checked the exact 16 KiB boundary, stream cancellation before oversized XML parsing, capped local JSON messages, UTF-8 characters split across chunks, known code mapping with a parser stub, and status/network/cancel/timeout distinctions. Native DOMParser/browser and live GCS were not rerun; previously captured ordinary short-error screenshots retain the same visible messages. No permanent tests were added.
