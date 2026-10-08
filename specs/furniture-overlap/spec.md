# Furniture overlap feedback (#75)

## Source and acceptance

Source: [GitHub issue #75](https://github.com/AtsushiHosaka/zenn_hackathon_5_takarada/issues/75), inspected 2026-10-09. Google Docs URL is unset in `docs/project.md`; this issue and the user request are the provisional specification. These decisions have not been copied to Google Docs.

- Detect overlapping furniture in the room preview.
- Draw a red outline around each entire overlapping furniture object, rather than tinting its faces or highlighting only the intersection.
- Clear the outline when the overlap is resolved.
- Retain surface placement (#78), camera controls (#71), and mirror rendering (#76).

## Implementation decisions

- Detect against visible leaf meshes in each procedural or per-product GLB group. A broad world box eliminates distant pairs; oriented mesh boxes handle rotated and mirrored geometry. Independent leaf meshes preserve empty space between separate table/chair legs. Instanced meshes are included.
- Ignore penetration up to 3 mm to avoid warnings for support contact and numeric rounding. Contact with the floor, a tabletop, or another furniture surface is not an overlap.
- Recompute after visibility changes, drag/cancel, and asynchronous product-model loading. Render each conflicting group separately through an outline mask, including hidden boundary edges; materials retain their original colors. Thumbnail previews do not run this effect.
- Complete-room models map actual meshes by explicit node ownership (item ID/name or GLB extras), or unique whole-mesh containment in an oriented metadata box. Regrouping preserves exact world transforms, including reflection/shear. Ambiguous ownership is reported rather than inferred or cropped. Spatial or leaf-only ownership also reports incomplete coverage because it cannot prove that all remaining furniture parts belong to the same owner. Explicitly owned group subtrees provide full coverage.
- Auxiliary outline depth/mask passes temporarily suppress Reflector callbacks, restoring them immediately afterward. The normal color scene render still refreshes reflections.

## Limits retained explicitly

Mesh boxes approximate individual mesh volumes. A hollow/curved mesh or sheared transform may conservatively warn even if its triangles do not intersect; this is not exact triangle collision. A complete-room GLB with missing or ambiguous furniture ownership displays an explicit list of furniture that cannot be checked. Named/extras-owned group subtrees provide full coverage. Uniquely contained or individually tagged meshes provide partial checks with an explicit incomplete-coverage warning; an arbitrary merged mesh spanning several pieces cannot supply trustworthy individual silhouettes. No false clean scene or invisible metadata-box outline is substituted.

No API, database, environment variable, or iOS contract changes. No new repository tests; use existing lint/build plus temporary geometry and browser verification.
