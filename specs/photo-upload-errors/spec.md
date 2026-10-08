# Photo upload limits and errors

Source: GitHub issue #65. Google Docs URL is unset in docs/project.md; this change is unreflected there.

Show JPEG/PNG/WebP, maximum four files, and 10 MiB (10,485,760 bytes) per file at the photo picker. Match RoomPhoto::MAX_BYTES and MAX_COUNT; do not raise either limit. Reject empty, unsupported, and oversized files with filename-specific messages before upload. Keep valid selections when another selected file fails validation.

Signed upload failures distinguish known HTTP status categories, timeout, cancellation, and connection failure. A generic network failure must not be called a size overflow. HTTP 403 does not establish that the signature expired; HTTP 422 identifies a mismatch in the local upload contract. Provider upload errors preserve status without displaying signed URLs or response bodies.

Validation: frontend lint/build and local browser checks. Production GCS failure was not reproduced; UI evidence uses a controlled API response fixture.
