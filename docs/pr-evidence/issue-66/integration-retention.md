# Independent template integration verification

Verified source: `297b2515213a0a6efb1b4a10b2509d4fa25179ed` (complete feature integration), 2026-10-09. This records independent source/repository checks of the existing integration; it adds no application changes or permanent tests.

| Exact-source check | Result |
| --- | --- |
| Eight character themes × 60 explicit palettes and omitted palette (488 combinations) | Snapshot, save/edit, storage reload, offline/API reuse and derived overlay retain identities and edited colors. Invalid identities/types reject. |
| Three custom inferred and three measured floor colors | Visible colors become copied room baselines, remain in API scene input, survive save/reuse and leave the original room immutable. Invalid overrides reject; absent override retains the measured original or inferred default. |
| 64 measured/inferred support profiles | Four rotations, four positive/negative scales, circular/rectangular surfaces retain remapped support IDs, captured contact height, supporting position, and identical corner-to-local affine coordinates after recentering. |
| Supported image goods | Snapshot, storage reload, offline/API reuse and derived overlay retain the image and valid surface contact. |
| Imported furniture reference photos and artwork | Both validate with owned template IDs and retain their exact normalized data through snapshot/storage/reuse. Arbitrary IDs, suggested ownership, invalid images and incompatible categories reject. |
| Actual private API edit adapter | Template artwork is omitted from edits; manual artwork is transmitted. Coordinates retain base contact height. |
| Source immutability | Original designs, profiles, positions and images remain unchanged throughout. |
| Existing frontend lint and production build | Passed; existing large-chunk warning remains. |

The checks invoked the actual TypeScript functions and repositories through temporary Node transpilation. Only the Vite environment value was substituted for this execution. API reuse used an in-memory response reflecting the submitted template scene; this is request/adapter proof, not an authenticated backend or provider run. No browser, Vite server, container or remote changes were made. No existing screenshot is attributed to this newer source.

Templates and their visual image/support metadata remain scoped to the current browser as described in the feature specification. Backend scene creation and rendered UI evidence retain their separate original provenance in the existing issue-66 README.
