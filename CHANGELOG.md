## [v2.0.3] — 2026-04-27 — UI Bug Fixes

### Fixed
- Claim Gift button text is now properly centered
- Codex rarity breakdown and filter now include Prismatic
- Codex rarity labels now show the full name instead of a 3-letter abbreviation

---

## [v2.0.2] — 2026-04-27 — Concurrency & Race Condition Fixes

### Fixed
- **Harvest race conditions** — rapid harvesting (individual clicks, "Collect All", or both simultaneously) no longer produces "No plant in this plot" errors or spurious rollbacks
  - All harvest server calls are serialized through a client-side queue so concurrent DB grid writes can never overwrite each other
  - `getState()` (backed by a synchronous ref) replaces stale render-closure `state` in all action handlers so each rapid click chains off the previous optimistic result
  - Surgical rollback on failure restores only the affected plot cell, leaving other concurrently-harvested plots intact
  - `harvestingPlots` ref blocks the seed picker from opening on plots whose harvest is still in-flight
  - `harvestingRef` per tile prevents double-clicking the same bloom tile
  - `harvestPending` prop lets each PlotTile check whether Collect All already queued it, preventing double-queue when both paths fire for the same plot
- **Sell race conditions** — rapidly clicking "Sell 1" or "Sell All" no longer produces "Item not in inventory" errors
  - `sellingRef` per inventory card blocks any sell while the current server call is in-flight
  - Sell handler reads live quantity from `getState()` instead of the stale render prop
  - Serialized sell queue prevents concurrent DB inventory writes from racing each other
- **Buy race conditions** — rapidly clicking "Buy" or "Buy All" in the shop no longer produces "Flower not in stock" / "Fertilizer not in stock" errors
  - `buyingRef` per shop card blocks any buy while the current server call is in-flight
  - Buy handlers read live shop quantity from `getState()` to short-circuit when stock is already depleted optimistically
  - Serialized buy queue prevents concurrent shop writes from racing
- **Harvest → plant race** — "Collect All" now awaits all queued harvests before "Plant All" fires, preventing plant-seed from racing a harvest that hasn't hit the DB yet
- **Collect All double-queue** — clicking "Collect All" while individual tile harvests are in-flight no longer double-queues the same plot
- **Idempotent harvest edge function** — server now returns 200 (no-op) when a plot is already empty instead of 400, stopping the rollback → re-queue cascade that previously multiplied errors
- **Idempotent sell edge function** — server now returns 200 (no-op) when an item is already sold/depleted instead of 400, for the same reason

---

## [v2.0.1] — 2026-04-26 — Edge Function Hotfix

### Fixed
- All game actions (plant, harvest, sell, buy, fertilize, upgrade) were returning 401 Unauthorized and rolling back — root cause was local JWT verification using `SUPABASE_JWT_SECRET`, which is not automatically injected into Edge Functions
- Harvest failing server-side bloom check because `bloomedAt` is client-only and never written to the DB — fixed by computing bloom status server-side from `timePlanted` + growth catalog + fertilizer + mastery
- Shop sell values were completely stale for newer flowers (many returned 0 coins) — updated to match current full flower catalog
- `apply-fertilizer` rejecting `advanced` and `elite` fertilizer types — these were missing from the valid types list

### Changed
- All Edge Functions now use `auth.getUser()` for JWT verification (reliable, officially supported)
- JWT decode + DB load run in parallel via `Promise.all` — auth and save are fetched simultaneously to reduce latency
- All Edge Functions now use targeted column selects instead of `SELECT *` to reduce DB payload

---

## [v2.0.0] — 2026-04-26 — Server-Authoritative Architecture

### Added
- **🔒 Server-authoritative game logic** — all actions (plant, harvest, buy, sell, fertilize, upgrade, convert) are now validated and written server-side via Supabase Edge Functions
- **Optimistic UI with automatic rollback** — actions feel instant but revert silently if the server rejects them
- `marketplaceSlots` field on game saves (default 2) in preparation for v2.1.0 Marketplace
- Server-side audit log for all game actions

### Changed
- `game_saves` is now protected by Row Level Security — clients can only read their own save; all writes go through Edge Functions
- Removed client-side auto-save for signed-in users — Edge Functions own all writes

### Security
- Game state can no longer be manipulated via client-side localStorage or direct Supabase writes
- Coin calculations, inventory changes, and discoveries are all validated server-side

---

## [v1.6.0] — 2026-04-26 — Economy & Prismatic Update

### Added
- **🌈 Prismatic rarity** — a new tier above Exalted with animated rainbow borders, glow, and color; obtainable only through Botany
- **20 new flowers** — 3 Uncommon, 5 Rare, 4 Legendary, 1 Mythic, and 6 Prismatic including the special Princess Blossom
- **⚡ Codex Mastery** — fully discover a flower (base bloom + all 9 mutations) to permanently grow that species 20% faster
- **Mastery indicators** — ⚡ badge in the seed picker and yellow highlighted timer in the plot tooltip show when a mastery bonus is active

### Changed
- Shop now rolls rarity first (weighted: Common → Mythic), then picks a random flower from that tier — guaranteeing variety across all rarities
- Shop buy price changed from 60% → 75% of sell value
- Sell values rebalanced across all tiers — each tier now has at most a 2× spread from cheapest to most expensive, scaled by growth time

### Fixed
- Coral Bells renamed to Pearlwort with a working emoji (previous emoji was broken on older devices)

---

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
