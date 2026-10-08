# Panel/planner motion integration base

Issues #54/#55 use an isolated base combining current feature PRs so their review diff contains motion wiring. No main branch merge is performed.

Dependency heads read on 2026-10-09:

- #97 (#79): 1aec4b8cedf555725f4f611decf11e4fe92445ba, including its existing #90/#89/#93/#87/#84/#82/#80 stack.
- #91 (#50): 71e6f476c69c91a6d42f1faadaa9bd64ff95f288.
- #95 (#67): 64021c7dd13b6b10e7422abb8dd1d7b93ccc20f6.
- #92 (#63): 12f9588a17d8a37ebf5b54efa119facdff7621d4.
- #99 (#66): d9664376f94cc77333848d1e84402879215259eb.

Conflicts preserve color search and per-product replacement, scoped import libraries/reference photos, generated theme/palette and phase behavior, current/new follow-up mode, detected-furniture controls and template editing/storage.

Compatibility correction: a shared `isTemplateFurniture` helper identifies existing `template-object-UUID` objects. They are excluded from photo detections and do not become manually appended objects. Bounded local artwork/reference images remain valid on template base objects, persist as browser overlays after generation and never enter the backend's manual-only artwork input. Palette/theme metadata is retained in template snapshots. Existing manual imports remain separately identified.

Frontend lint/build passed after merging dependencies. Temporary exact-source checks passed copied artwork/reference-image validation, invalid external reference rejection, and omission of template artwork from manual-only server edit payloads. Screenshot evidence for each dependency belongs to its original PR. Integration browser verification is recorded by the motion feature PR; deployed/provider behavior is not claimed here.
