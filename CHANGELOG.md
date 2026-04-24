# Changelog

All notable changes to Chrysanthemum are documented here.

Format: `Added` for new features, `Changed` for changes to existing features, `Fixed` for bug fixes, `Removed` for removed features, `Balancing` for economy/gameplay tuning.

---

## [v1.0.0] — 2026-04-24 — Initial Release

### Added
- 80+ flowers across 5 rarity tiers: Common, Uncommon, Rare, Legendary, and Mythic
- 6 mutations: Golden (3×), Rainbow (2.5×), Giant (2×), Moonlit (2×), Frozen (1.5×), Scorched (1.5×)
- Time-based growth system with offline progress calculation
- Farm upgrades from 3×3 Starter Plot to 6×6 Grand Estate
- Randomised shop restocking every 10 minutes, slot count scales with farm size
- Three fertilizer tiers: Basic (2×), Premium (5×), Miracle (10×)
- Floral Codex tracking every species and mutation ever harvested
- NEW badge in shop for undiscovered flowers, DONE badge for fully completed species
- Google OAuth sign-in via Supabase with cross-device cloud saves
- Guest play with local save, upgradeable to cloud account at any time
- Save migration flow when local save is newer than cloud save
- Friends system: send, accept, and decline friend requests with real-time notifications
- Flower gifting with optional message, real-time gift notifications
- Global leaderboard (top 50 by coins) and friends leaderboard
- Player profiles with read-only garden viewer, collection, codex preview, and display flower
- Display flower unlocked by codex discovery, not inventory
- Social tab with Search, Friends, Gifts, and Leaderboard sub-views
- Profile overlay navigation — back button returns to previous tab
- Shop restock banner notification
- Offline harvest banner on return
- Version check with update banner on new deploy
- Responsive layout — full width on mobile, capped on desktop
- Responsive garden grid — smaller cells on mobile for 5×5 and 6×6 farms
- Seeds and harvested blooms tracked separately — seeds can only be planted, blooms can only be sold
- Inventory shows seeds, blooms, and fertilizers with sell-all button for blooms

### Balancing
- Seed prices set at 60% of bloom sell value to ensure consistent profit per grow cycle
- Growth times range from 40 seconds (Quickgrass) to 48 hours (Chrysanthemum)
- Shop slot count: 4 seeds at 3×3, up to 8 seeds at 6×6
- Farm upgrade costs: 3×3 free → 4×4 1000 → 5×5 5,000 → 6×6 25,000