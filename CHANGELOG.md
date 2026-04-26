## [v1.5.2] — 2026-04-26 — Bug Fixes

### Fixed
- Leaderboard filter buttons (Global, Friends, Coins, Codex) are now a single equal-width row on mobile

---

## [v1.5.1] — 2026-04-26 — Quick Fix

### Fixed
- Changelog modal is now scrollable on mobile so the dismiss button is always reachable

---

## [v1.5.0] — 2026-04-26 — Weather & Mutations Update

### Added
- **Weather Forecast** — unlock up to 8 slots to preview upcoming weather events with estimated start times; upgrade cost scales from 500 → 300,000 coins
- **⛈️ Thunderstorm** — 2× growth speed; unmutated plants can become Wet or Shocked directly, and Wet plants can upgrade to Shocked over the course of the storm (~50% chance over 20 min)
- **🌪️ Tornado** — instantly applies a random mutation to every bloomed flower in the garden
- **⚡ Shocked mutation** — applied by thunderstorm; upgraded from Wet during a storm
- **💨 Windstruck mutation** — applied instantly by tornado
- **Day/night ambient tint** — screen shifts through dawn, morning, midday, afternoon, sunset, dusk, night, and midnight
- **Display flower mutation badge** — your selected mutation shows as a small icon on your profile flower in the HUD and social tab

### Changed
- Profile page is now embedded inside the Social tab — the 5-button nav (Search, Friends, Gifts, Ranks, My Profile) stays visible at all times
- Wet → Shocked upgrade now applies gradually (~50% chance over the storm duration) instead of instantly on first tick

### Fixed
- Rarity borders and backgrounds now correctly display on other players' profile gardens (#30)
- Fertilizers in the plot tooltip are now sorted by effectiveness, weakest to strongest (#31)
- Social tab buttons are equal-width and emoji-only on mobile (#29)
- Social tab no longer deselects in the navbar when viewing a profile
- Weather forecast no longer shows "0m 0s" during clear skies

---

## [v1.4.0] — 2026-04-26 — Mutations Update

### Added
- **Flower mutations** — bloomed flowers can now carry a mutation that changes their appearance and multiplies their sell value
- **8 mutation types** — Giant (8% flat chance on bloom), Wet (Rain), Scorched (Heatwave), Frosted (Cold Front), Stellar (Star Shower), Prismatic (Prismatic Skies), Gilded (Golden Hour), Moonlit (Moonlit Night)
- Mutation badge displayed on flowers in the inventory, gift inbox, and garden tooltip
- Mutations discovered via gifts or harvests are registered in the Floral Codex

### Changed
- Weather mutations only roll on fully bloomed flowers — seeds and sprouts are unaffected
- Growth progress bar now accumulates correctly so it speeds up during rain and slows back down smoothly without snapping

### Fixed
- Rarity glow border on mutated flowers in the inventory was being replaced by the mutation colour — both now display together (#22)
- Flowers received as gifts now appear in the Botany Lab and Floral Codex (#20, #21)
- localStorage exploit: local saves with a `lastSaved` timestamp more than 30 s in the future are now rejected in favour of the authoritative cloud save (#26, #27)

---

## [v1.3.0] — 2026-04-26 — Quality of Life

### Added
- **Collect All** — harvest every bloomed flower in the garden with one tap
- **Plant All** — fills all empty plots automatically, prioritising your highest-rarity seeds first
- **Buy All** — purchase the entire stock of any shop slot in one click
- **Convert All** — runs as many Botany Lab conversions as possible at once for a given tier
- **My Profile** button on the Social tab for instant access to your own profile page
- **Profile status message** — set a short message (up to 80 characters) displayed on your profile

---

## [v1.2.2] — 2026-04-26 — Polish & Fixes

### Fixed
- Harvest popup now appears immediately on harvest instead of on the next plant action
- Shop cards flash green with "✓ Bought!" confirmation to prevent accidental double-purchases
- Floral Codex descriptions no longer truncate on mobile — tap any entry to expand
- Weather tooltip now correctly shows accelerated stage and countdown during rain
- Username hidden on mobile HUD to reduce crowding — profile emoji remains tappable
- Weather countdown on mobile now shows minutes only instead of minutes and seconds

---

## [v1.2.1] — 2026-04-25 — Bug Fixes & Balancing

### Fixed
- Cloud save no longer loses progress on page refresh — localStorage is kept as a shadow backup and recovered automatically if the cloud write was still in-flight
- Signing in after a guest session no longer overwrites cloud progress with the default guest state
- Two devices logged into the same account now correctly load the most recent save on login
- Removed output flower emoji previews from Botany Lab tier cards

### Changed
- Farm upgrade costs rebalanced (Grand Estate 30k, Sprawling Estate 100k, Manor Garden 350k, Grand Manor 750k)

---

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
