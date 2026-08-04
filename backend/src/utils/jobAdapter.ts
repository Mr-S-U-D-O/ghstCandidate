// ── DECOMMISSIONED — jobAdapter.ts ────────────────────────────────────────────
//
// This file previously contained Apify actor wrappers for Greenhouse, Lever,
// and Ashby job scraping:
//   - runApifyActor()
//   - fetchFromGreenhouse()
//   - fetchFromLever()
//   - fetchFromAshby()
//   - harvestAllSources()
//
// As of Phase 27.4 / 28, these have been replaced by the modular skill provider
// architecture located at:
//   backend/src/skills/providers/
//
// The seedHarvester endpoint in jobController.ts now calls ingestFeeds() from
// the new harvester, which orchestrates the modular providers directly.
//
// This file is intentionally empty. It is retained to prevent any stale imports
// from causing TypeScript compilation errors if any reference remains. Once all
// import sites are confirmed clean, this file should be deleted entirely.
//
// Decommissioned: Phase 27.4 / 28 (2026-08-04)
// Replaced by: backend/src/skills/providers/ + backend/src/utils/cron/harvester.ts

export {}
