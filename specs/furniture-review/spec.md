# Furniture feedback

Source: PR #134 and the user's 2026-10-12 request to merge all open PRs. Google Docs is unset in `docs/project.md`; these decisions are not reflected in Docs.

The selected-furniture panel can ask whether the current furniture fits the room. The authenticated API evaluates the submitted furniture, surrounding furniture, room dimensions/colors and room brief. Results are transient. Gemini may use the registered product photo; the deterministic fallback is identified as `mock`.

Changing a reviewed input clears the previous result and cancels any pending request. An answer for an earlier furniture color, size, placement, room or brief must not appear as current feedback.

Product photos are optional. Fetch only public HTTPS destinations, validate and pin the resolved address, and bound the response size and overall download duration. A failed or rejected photo fetch continues without a photo. API response fields, DB schema and environment variables remain unchanged by these integration repairs.

Verification is recorded separately from production/provider evidence. Existing request specifications and CI remain the API-contract checks; no additional permanent tests are required by this merge request.
