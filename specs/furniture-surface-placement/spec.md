# Small objects on furniture (#78)

Source: GitHub issue #78, 2026-10-09. Google Docs URL is unset; Docs is unverified and these decisions have not been reflected there.

Compact objects up to 80 cm on each axis, including acrylic stands, automatically rest on the highest fitting shelf, desk, or table top. Floor furniture, posters, rugs, mirrors and lamps retain their positioning rules. A full rotated rectangular footprint must fit on the support, and the object must fit below the room ceiling. Positions keep the existing 10 cm horizontal grid; vertical contact is exact and is not rounded to that grid.

The same placement function serves adding, drag previews/drop, existing object movement, keyboard movement, rotation and resizing. Dragging off a support returns compact objects to the floor. Canceling restores the original position. Existing edited-item persistence stores the vertical center and API serialization preserves its bottom coordinate. No additional canvas or render loop is created.

Support tops use the existing scene dimensions/rotation; completed room GLBs retain their existing disabled layout-edit behavior. Moving a support does not carry its contents automatically; intermediate shelves inside a single model are not separate placement targets.

Dependencies: image-goods import (#72) and furniture focus (#71). No API or DB contract changes.

Verification pending source checks, frontend lint/build, and local browser drag/save/reload screenshots.
