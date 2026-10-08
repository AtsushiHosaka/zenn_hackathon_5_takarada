# Legal document links and signup availability

## Source and scope

On 2026-10-07, dogfood OBS-001 found that signup required consent while both documents were unavailable. On 2026-10-08, the user selected: remove dummy consent and pause API signup until official documents are configured.

The Google Docs URL in `docs/project.md` remains unset. The explicit requests and existing QA evidence are the provisional sources; this decision remains unreflected in Docs. No official legal text or publication URL is invented.

## Acceptance criteria

- Configured HTTPS URLs or same-origin root paths open each official document in a new tab and preserve the signup form.
- Web and API accept the same URI-encoded ASCII configuration format: percent-encode non-ASCII paths and use punycode hostnames. Invalid percent escapes, raw spaces inside URLs, out-of-range ports, invalid schemes, external HTTP, credentials and protocol-relative paths are rejected.
- Dummy signup clearly identifies the demo and has no consent checkbox.
- Web API signup is paused when either document URL is absent or invalid. The disabled submit button and submission handler both prevent signup requests.
- The backend signup endpoint also rejects registration while either runtime document URL is absent or invalid; existing login remains available.
- API signup resumes when both documents are configured, and its Web form requires consent.
- Vite, Compose, Docker, manual release and GitHub Actions provide the corresponding build/runtime configuration.

## Configuration

The Web reads `VITE_TERMS_URL` and `VITE_PRIVACY_URL` at build time. Repository variables supply the Actions build, and same-named environment variables supply manual releases. Changes require rebuilding the Web. The API receives the same public values at runtime. Operators provide and publish the actual documents.

## Verification

The original 2026-10-07 checks passed frontend lint/build, release shell syntax, document navigation in separate tabs, preserved form input and rejected invalid URLs. They used temporary document pages that were removed, and did not verify official document content.

On 2026-10-08, existing frontend lint/type checks/build passed. Browser verification confirmed dummy demo/no consent, missing-document API signup pause with disabled fields and submission, available login, and configured document links opening separate tabs while preserving nickname input. Temporary document pages and environment values were removed.

The existing Rails suite passed 45 examples, including 9 authentication examples. Temporary actual endpoint checks confirmed 14 unavailable/invalid configuration cases return 503 without records or JWT, and 4 configured cases succeed with rolled-back records. Web and API URL validation agrees on encoded Japanese paths, invalid ports, spaces and percent escapes. Swagger and frontend API types were regenerated; Ruby lint, release shell syntax and whitespace checks passed. No new automated tests were added apart from the minimum 503 Swagger response contract. Official document availability and deployed signup behavior were not verified locally.

## Remaining configuration

Official documents and their URLs remain unpublished or unspecified. Under the user-selected policy this keeps API signup paused; it no longer blocks implementing and merging the policy. No legal text is fabricated.
