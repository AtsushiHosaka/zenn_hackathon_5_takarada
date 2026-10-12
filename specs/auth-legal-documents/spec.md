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

At the 2026-10-08 checkpoint, official documents and their URLs remained unpublished or unspecified, keeping API signup paused.

## Same-domain publication approved on 2026-10-12

The user requested publication of Terms and Privacy pages on the app's existing domain, delegated their contents, and supplied `hosaka2917@gmail.com` as the private contact address to list. This supersedes the earlier absence of approved publication content. The Google Docs URL remains unset; this request and implementation decision remain unreflected in Docs.

- Publish Japanese static HTML at `/terms.html` and `/privacy.html`, accessible without login or JavaScript. Share responsive, printable styling through `/legal.css`.
- Identify the operator as チーム「takarada」, as explicitly corrected by the user on 2026-10-12. This supersedes the initial individual-operator attribution. Include the supplied email for private data requests.
- Describe account information, room photos, prompts/budgets/layouts, imported images, browser storage, operational logs, Google Cloud/Vertex AI processing, external shop links, and account deletion according to current code.
- Disclose that original room photos are private and become eligible for lifecycle deletion after seven days; withdrawal does not immediately remove photo objects, logs, or browser data. Distinguish public catalog models/textures from private room data.
- Avoid claims of guaranteed accuracy, immediate deletion of all information, Japan-only AI processing, or universal no-retention. Keep statutory rights and liability that cannot be waived intact.
- Configure Web build and API runtime legal paths together, keeping `SignupPolicy` and the signup consent checkbox. Ship matching defaults through Docker, Compose, Actions, manual release, environment examples, and Terraform so later releases do not silently re-disable registration.
- Deploy the Web documents first, verify their contents, then update the existing API environment without changing its image or running database/seed jobs. Persist the repository variables for future deployments.

Sources checked on 2026-10-12: current application code and schema; deployed API `GEMINI_PROVIDER=vertex` and `GOOGLE_CLOUD_LOCATION=global`; deployed uploads-bucket lifecycle age of seven days; [PPC general guidelines](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/), [Ministry of Justice contract rules](https://www.moj.go.jp/content/001289629), and [Google Vertex AI data handling](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention). Publication does not constitute independent legal certification.

### Verification and production release

On 2026-10-12, frontend ESLint and TypeScript/Vite build passed. The existing bundle-size warning remains. Release shell syntax, Terraform format/validation, resolved Compose configuration, and whitespace checks passed. Japanese static and diff checks were reviewed; repeated polite endings were retained where natural for rules and policy text. No new automated tests were added.

Browser checks confirmed public legal content, working contents anchors, a 375px Privacy layout without horizontal overflow, enabled signup fields/button and required consent, and Terms opening in a separate tab while retaining a typed nickname. Production Terms, Privacy, and CSS each returned HTTP 200 and exactly matched reviewed source.

Targeted publication used Web image digest `sha256:9564fd5c2f1df95a02f3ec0398d1fc932f8e73e7f4aff21bdf4c12fdf9819758` on revision `zenn-hackathon-web-00050-klv`. API revision `zenn-hackathon-api-00049-25z` retained the existing code image and changed only the two legal environment values. Both repository deployment variables were saved. API health returned HTTP 200. A same-origin POST to signup with empty required fields returned HTTP 422 validation errors without a JWT, confirming registration reaches validation instead of the document-policy HTTP 503. No real account was created and successful account creation was not exercised.

Screenshots are saved in `docs/pr-evidence/legal-pages/`. The targeted release did not run database, seed, or provider-generation jobs.
