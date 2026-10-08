# Confirm detected furniture (#63)

Source: GitHub issue #63, retrieved 2026-10-09. Google Docs is not configured in docs/project.md; these decisions have not been reflected in Docs.

The API room editor lists every original detected furniture object with a native, labeled checkbox. Checked objects are confirmed and retained in the next coordination through the existing kept_object_ids and furniture_operations contract. Unchecking changes that object's operation to remove. Checking again changes it to keep. Existing keep choices remain checked when the editor opens; explicit replace/remove choices remain unchecked. The advanced replacement controls continue to work and the list identifies replacement requests.

Acceptance: all original detected objects are listed, keyboard activation works, unchecked objects are absent from kept_object_ids, checked objects use keep, and replacement operations are not silently overwritten by opening the editor. Generation uses the existing request contract; this change adds no API, database, or iOS contract.

Verification: lint and production build passed. Local browser API fixtures confirmed the complete detected list, Space-key toggling, checked keep IDs, unchecked remove operations, replacement preservation when reopening the panel, and checking a replacement again to choose keep. Captured desktop and 390px screenshots. The existing narrow two-column editor compresses its content at 390px; this is recorded for issue #58's responsiveness work. Real photo detection, backend generation, and deployed behavior remain unverified.
