# Photo upload limits and errors

Source: GitHub issue #65. Google Docs URL is unset in docs/project.md; this change is unreflected there.

Show JPEG/PNG/WebP, maximum four files, and 10,485,760 bytes (displayed as 10MB with the exact byte count) per file at the photo picker. Match RoomPhoto::MAX_BYTES and MAX_COUNT; do not raise either limit. Reject empty, unsupported, and oversized files with filename-specific messages before upload. Keep valid selections when another selected file fails validation.

Signed upload failures distinguish known HTTP status categories, timeout, cancellation, and connection failure. A generic network failure must not be called a size overflow. HTTP 403 does not establish that the signature expired; HTTP 422 alone does not confirm whether the cause is a format or byte-count mismatch; preserve a returned JSON reason when available, otherwise show the status and state that the detailed cause is unconfirmed. Provider upload errors preserve status without displaying signed URLs or response bodies.

Validation: frontend lint/build and local browser checks. Production GCS failure was not reproduced; UI evidence uses a controlled API response fixture.


## Consolidated implementation and evidence

PR #80 remains the canonical issue #65 pull request. Its forward merge includes the validated implementation and four screenshots originally created for duplicate PR #85, while retaining this spec and the earlier `docs/pr-evidence/issue-65/upload-limit-error.png` capture. That earlier capture documents the preceding wording; the four captures listed in `specs/room-photo-feedback/spec.md` show the final wording and behavior.

The shared frontend validation now uses `roomPhotoLimits` and `roomPhotoValidationError`. Signed PUT responses parse GCS XML error codes and local JSON error messages, report confirmed reasons and filenames, and avoid interpreting all 403 responses as expiry or all 422 responses as a specific mismatch. Full acceptance, source references, browser checks and production limitations are recorded in `specs/room-photo-feedback/spec.md`.
