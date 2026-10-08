# Complete motion integration review — issue #58

Source: GitHub issue #58, read 2026-10-09 JST. Google Docs URL is unset in `docs/project.md`; the issue and authorized repository work are the provisional source. Feature issues #50–#57 own their implementations; this review owns their composition and any defects exposed by that composition.

## Integration under review

The local review branch combines the published high-priority fixes with detected-furniture controls, scoped image imports, reusable templates, furniture focus, and the published motion foundation/authentication/studio/navigation PRs. No main merge or deployment has been performed. Existing frontend lint, typecheck and production build pass at integration revision `932393544fba444d9e87ad99bbe8f336c569f58b`; the existing large-chunk advisory remains.

Independent source review found a sample-photo keyboard-focus defect in PR #102. The corrected effect observes both real-file and sample-photo counts. The actual-effect probe distinguishes the old failure from the corrected behavior. Browser verification and final panel/planner integration remain in progress.

## Coverage record

| Surface | Verification required | Current evidence |
| --- | --- | --- |
| Saved-room carousel / New Room | Native activation, arrows, keyboard, Back, one ready preview | Feature PR #103 source and browser evidence; final composition pending |
| Chat / setup / photos | Stable identities, focus, scroll preservation, validation, interrupted exits | Feature PR #102; sample-photo focus correction included; final composition pending |
| Generation / result | Pending, fast success, failure, stop, retry, navigation, actual readiness | Feature PR #102 controlled HTTP/WebGL evidence; final composition pending |
| Product / edit panels | Open/close/reopen/switch, filtering, scroll/focus, retained viewer | Feature work #54 pending publication and final composition |
| Planner | Selection, requests, swatches, dimensions, drag, history/save/download | Feature work #55 pending publication and final composition |
| Native dialogs | Escape, backdrop, focus containment/restoration, rapid reopen | Feature PR #96 evidence; final composition pending |
| Auth / account / feedback / recovery | Validation, pending semantics, alerts, success timing, keyboard | Feature PR #96 evidence; final composition pending |
| Newly integrated templates/imports | Native operation plus consistent feedback/dialog behavior | Feature PR #99/#95; final composition pending |

## Boundaries

Browser fixtures and dummy mode operate the actual application, but do not establish production authentication, live generation, retailer availability, deployed performance, physical touch hardware, or assistive-technology behavior. No destructive account deletion, permanent test addition, new browser application, container, or test framework is required for this review. Intentional injected failures must be separated from unexpected console errors.
