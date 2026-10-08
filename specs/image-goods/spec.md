# Image goods import

Source: [GitHub issue #72](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/72), read on 2026-10-09. The Google Docs URL in `docs/project.md` is unset; Docs were not read or changed. These implementation choices remain unsynchronized with the shared specification.

The room editor must create a poster and an acrylic stand from an imported image and place both in the 3D room. The image palette appears alongside the existing link/manual furniture controls. Users select JPEG, PNG, or WebP up to 10MB, choose a goods type and height, and click to place centrally or drag onto the room floor. Width preserves image aspect ratio. Posters have a thin backing; acrylic stands have a translucent base and an alpha-tested image plane. PNG/WebP transparency is preserved. Automatic background removal and fabrication of physical merchandise are outside the request.

Existing position, rotation, dimensions, undo/redo, deletion and save controls also apply to image goods. A floor-height input allows positioning a poster against a wall or a stand on a table. Height remains bounded by the room; movement preserves elevation. Placement is available in procedural/shell rooms; existing complete GLB rooms continue to disallow individual editing because their furniture is baked into the model.

Image data is normalized in the browser to PNG with a maximum 512px edge and reduced further if necessary to stay below 262144 data-URL characters. A room may import up to 1MiB of image data. This bounds WebGL texture costs and browser persistence. Original full-resolution files are not retained. Imported art is separate from product image URLs, and remote URL/SVG artwork is not accepted.

Local edits use the existing browser store scoped by connection, API origin and authenticated user ID. Saving an edit alone remains browser-local; generating a coordination sends the manual image goods in `edited_objects.artwork.data_url` and persists them in authenticated before/after scenes. API reads remain scoped to the room owner. No DB migration, new endpoint, environment variable or object-storage bucket is required. iOS receives optional `artwork` metadata in SceneObject; native iOS image-goods rendering is not implemented here.

The backend accepts poster/acrylic_stand as manual categories while leaving furniture additions and replacement categories unchanged. Artwork validation checks a bounded PNG data URL, strict base64, PNG/IHDR headers and dimensions. The total artwork budget per edited_objects request is 2MiB. The planner receives labels and dimensions rather than the image bytes.

## Verification

- Frontend lint and production build passed. Build retains the existing large-chunk warning.
- Swagger regenerated through Rails rswag in a temporary copied backend on the shared existing container; generated web types regenerated from it.
- Existing coordination/room request specs passed: 13 examples, 0 failures, isolated `issue72_checks_test` DB. The existing successful coordination contract now covers both imported categories and artwork in the response.
- Full backend RuboCop passed.
- A temporary rolled-back Rails transaction verified mock generation, database reload of both PNG images, elevation/rotation preservation and malformed-art rejection.
- Browser interaction, rendered transparency, save/reload, and screenshots remain for the root agent's shared browser review. Live Gemini, production and native iOS behavior are unverified.
