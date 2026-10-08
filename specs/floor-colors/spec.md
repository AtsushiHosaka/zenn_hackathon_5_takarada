# Editable floor color (#59)

Source: GitHub issue #59, 2026-10-09. Google Docs URL is unset; Docs is unverified and these decisions have not been reflected there.

The layout editor offers the existing color swatches and a native custom color picker for the floor. It uses the same immediate editing, undo/redo, dirty-state and save flow as wall color. Measured room geometry stores its floor color; an optional validated hex override covers legacy inferred/sample rooms. The viewer applies the override to floor surfaces and keeps floor joints visible. Before restores the original snapshot or legacy floor materials; After restores the edit. Floor edits do not alter furniture colors or the podium.

Local saved-room storage validates the override and preserves it across reload. Server-side floor mutation/regeneration and iOS floor editing are not introduced. Completed room GLBs keep the existing disabled architectural editing behavior because their floor is not a separately identified surface.

No API, DB or environment contract changes. API room geometry already includes floor_color. Template reuse of measured scenes uses that existing color.

Verification: frontend lint/build passed. Temporary checks using actual Three.js floor descriptors verified saved/invalid hex values, recolored sample floor faces, unchanged walls and original Before colors. Browser fixtures verified actual measured-floor material updates, swatches, a custom color through one DOM input event, undo/redo, original Before/edited After, save/reload, and mobile keyboard activation without horizontal overflow. Screenshots are in docs/pr-evidence/issue-59. The native operating-system color dialog, physical touch and deployed/provider paths remain unverified. The mobile editor panel expansion is handled by the separately stacked mobile editor PRs.
