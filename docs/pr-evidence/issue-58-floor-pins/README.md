# Floor-only changes retain sample reference pins (#58, #59)

The combined main revision `bc40f28936d680fa6aedad03e6e99be92f334b42` gated reference pins on an absent floor-color override. Changing floor paint therefore hid all eight pins despite unchanged reference geometry and camera. This follow-up removes only that floor-color guard; the existing identity, position, dimensions, furniture color, rotation, wall, style and item-count guards remain.

Existing frontend lint, typecheck and production build pass; the existing bundle-size advisory remains. An independent temporary probe evaluates the actual source predicate using the actual oshi sample: fourteen unchanged/floor-only/invalid-layout cases pass. No permanent tests or API changes.

Actual browser evidence uses the application in an isolated task-owned browser context with local dummy storage. The native floor swatch, save, editor close and reload preserve the chosen color, eight reference pins and one canvas. Reload intentionally restores the editor; pins are verified after closing it. Desktop and 390px reduced-motion screenshots show the resulting scene. This does not establish production authentication, provider behavior, physical touch or assistive-technology behavior.
