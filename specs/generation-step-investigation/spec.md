# Issue #69: generation step investigation

Source: GitHub #69; Google Docs URL is unset. Two numbered displays exist: RoomStudioPage input steps (room size, shape, optional photos), and RoomGenerating request steps. Input steps advance on submit after validation; invalid size or missing capabilities prevents advancement. The original screenshot was not supplied, so the exact reported display remains unconfirmed.

The generation display had a reproducible source defect: every render constructed the first stage as active and all later stages as pending. No request state reached the display. Any slow request therefore stayed on the first stage until navigation, including a successful request.

Fix: repository reports actual observable upload, room analysis, coordination request, and received-preview phases; UI marks prior phases complete. No timer-generated percentage or detailed provider stage is invented. The progressbar counts completed client phases, not elapsed provider work. Preview is prepared after successful response decoding; navigation immediately shows the result. Cancellation prevents late phase callbacks. Offline requests report their actual preparation/preview phases; sample-game is a demonstration route without a real job.

Verification: frontend lint/build; controlled local API fixture delays room analysis and coordination independently to prove transitions. Live Gemini/EC processing and production deployment are unverified. The inline backend cannot expose detailed provider sub-stages during one request.
