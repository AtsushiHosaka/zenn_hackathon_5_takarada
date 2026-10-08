# Issue #66 browser evidence

Captured from the issue #66 checkout on 2026-10-09 in installed Chrome, using the shared frontend server on 127.0.0.1:5174 and local intercepted API fixtures. These are actual rendered screenshots. Desktop is 1440×1000; mobile is 390×844.

- `template-library.png`: two independently saved templates; one active 3D canvas and an accessible preview-selection button on the other card.
- `template-editor.png`: saved template after furniture color/position/size/rotation edits, furniture add/delete/add, wall recolor and rename.
- `derived-room.png`: loaded scene of a separate saved room copied from the edited template.
- `mobile-library.png`: both templates and their edit/reuse/delete controls at mobile width.

The browser run also checked reload persistence, unchanged source/unselected template, two distinct derived room IDs with an unchanged first copy, owner isolation and no horizontal overflow. Console had React DevTools notices only. The UI fixture does not prove deployed API connectivity. Separately, authenticated Rack requests in an isolated local PostgreSQL database checked creation/retrieval, full scene preservation, ownership, independence, rejection of malformed inputs and subsequent coordination validation; all temporary DB records were rolled back.
