## [v1.2.0] — 2026-04-25 — The Botany Update

### Added
- **Botany Lab** — convert harvested blooms into a seed of the next rarity; undiscovered species are prioritised so botany helps complete the codex
- **Exalted rarity** — 7 new flowers obtainable only through Botany (Umbral Bloom, Obsidian Rose, Graveweb, Nightwing, Voidfire, Duskmantle, Ashenveil)
- **Purchasable shop slots** — buy up to 12 flower slots independently of farm size; empty placeholder slot appears immediately on purchase
- **Rectangular farm expansion** — farm can now grow beyond 6×6 up to 9×6 via three new upgrade tiers (Sprawling Estate, Manor Garden, Grand Manor)
- **20 new flowers** across all rarities — 6 common, 6 uncommon, 4 rare, 3 legendary, 2 mythic
- **Exalted** added to Floral Codex with its own filter and breakdown column
- **Codex sort on leaderboard** — toggle between ranking by coins or codex completion percentage

### Changed
- Shop countdown timer removed from HUD
- Leaderboard entry now shows the active sort stat (coins or codex) per row

---

## [v1.1.2] — 2026-04-25 — Weather Reliability

### Fixed
- Client-side fallback now advances weather immediately on page load if expired
- Weather event durations synced between client and server

### Added
- Offline banner greets you by name with a time-of-day message
- New update changelog shown once on first open after a new release

---

## [v1.1.1] — 2026-04-25 — Weather Tick Fix

### Fixed
- Weather cron changed from every 5 minutes to every 15 minutes to improve reliability
- Weather event durations and cooldowns scaled to match the new 15-minute tick interval

---

## [v1.1.0] — 2026-04-24 — Weather Update

### Added
- Global weather system — all players see the same weather simultaneously via Supabase Realtime
- 7 weather types: Clear, Rain, Golden Hour, Prismatic Skies, Star Shower, Cold Front, Heatwave
- Rain doubles plant growth speed while active
- Each non-rain weather type doubles one mutation's chance on harvest
- Weather HUD banner with live countdown and weather name
- Full-screen visual overlays per weather type with CSS animations
- GitHub Actions cron job calling advance_weather() SQL function every 5 minutes
- 10 new fast-growing flowers (2 per rarity) for better early/mid-game pacing

### Fixed
- Weather banner countdown now clears client-side without requiring a page refresh
- Display flower picker now shows all codex-discovered flowers rather than inventory only
- Seeds filtered out of collection display and display flower picker
- Mobile layout restored to full width with responsive padding
