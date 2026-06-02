## [v2.4.3] — 2026-06-01 — Bug Fixes

### Added
- **Claim All on Achievements panel** — one tap claims every completed achievement in sequence; a single SFX and toast confirm the batch (#285)

### Fixed
- **Coin display truncation above 100M** — trailing integer zeros were stripped by a regex intended only for decimal cleanup, causing 100M → "1m", 110M → "11m", etc.; fix scopes the strip to decimal-only; billion tier (1b+) added (#284)
- **"Session moved to another tab" false positive** — the stale-tab detector fired when the localStorage key was deleted (e.g. signing out in another tab), triggering the overlay with no second tab involved; now ignores key deletions and only triggers on an active session handoff (#283)
- **Volume sliders unresponsive on mobile** — iOS Safari does not reliably fire React's `onChange` during a touch drag on `<input type="range">`; added `onInput` and `touch-pan-y` so sliders update continuously while dragging (#286)
- **Flowers lost after Collect All** — if the DB inventory had duplicate entries for the same species (null vs undefined mutation from older saves), harvest-all stacked onto the first match and left the second intact, inflating counts and breaking subsequent sells; harvest-all now deduplicates and merges inventory on read (#287)
- **Buy All not tracked by daily tasks / achievements** — the bulk "Buy All Seeds" handler was missing the `trackProgress` and `incrementStat` calls that per-slot buys already had (#282)

---

## [v2.4.2] — 2026-05-14 — Alchemy Sacrifice Fix

### Fixed
- **Sacrifice fails for non-mutated blooms** — the same null/undefined mutation mismatch from v2.4.1 was present in `sacrificeFlowers`; strict `===` caused `null !== undefined` so every non-mutated bloom sacrifice returned "Invalid selection" before reaching the server; normalized with `?? null` on both sides

---

## [v2.4.1] — 2026-05-14 — Bloom & Achievement Fixes

### Fixed
- **Non-mutated bloom placement** — a null/undefined mutation mismatch between the DB and client caused non-mutated blooms to silently fail when placed from inventory with no error shown; both `SeedPicker`, `plantBloom`, and the `plant-bloom` edge function now normalize `null` and `undefined` identically (#271)
- **Species Discovered achievement wrong count** — progress was sourced from inventory instead of the codex (`state.discovered`), and mutation variants such as `rose:golden` were inflating the count on the server; both client and `achievement-claim` now filter to base species only (#275)
- **Mutation VFX missing on prismatic blooms** — an erroneous `rarity !== "prismatic"` guard in `PlotTile` suppressed the mutation sheen animation on all prismatic flowers (e.g. Sakura Blossom after a vial); the guard has been removed
- **Sakura Blossom "Unknown species" errors** — the event flower was absent from the hardcoded species tables in every edge function, causing 400 errors on vial use, harvest, alchemy sacrifice, botany conversion, gear actions, marketplace listing, shop, and offline tick; `sakura_blossom` is now registered in all affected functions

---

## [v2.4.0] — 2026-05-13 — The Sakura Blossom Update

### Added

#### Pixel Art Sprites
- **Full pixel art sprite system** — all 192 flowers, gear, consumables, essences, and UI chrome now render as hand-crafted pixel art sprites; a sprite toggle in settings lets you switch between sprite and emoji rendering
- **Mutation VFX** — mutated plants display a filter-based colorized sheen animation (grayscale → sepia → hue-rotate pipeline) across every surface: plot tiles, tooltips, seed picker, inventory, codex, marketplace, profile gardens, and my-listings cards; badge and VFX display are independently toggleable in settings
- **Medal sprites on leaderboard** — top-3 ranks show pixel art gold/silver/bronze medal icons; coin layout corrected alongside

#### Audio
- **Full audio system** — ambient background music (login lobby, daytime garden, nighttime garden), a separate weather ambience layer (rain, thunderstorm, wind), and sound effects for all major actions (plant, harvest, sell, buy, craft, level-up, shovel remove); music volume, SFX volume, and mute toggles added to the settings modal
- **Sequential title music playlist** — the login page cycles through a curated track library; each track plays in full before the next begins, looping continuously

#### Achievements, XP & Gems
- **Achievements** — 618 milestone achievements across 23 categories (harvests, coins earned, flowers discovered, gardener leveling, crafting, alchemy, daily streaks, and more); award gems on claim; a new Achievements panel with category tabs and animated progress bars lives inside the Events tab
- **Gardener XP & leveling system** — every game action grants XP: harvesting, selling, buying, crafting, alchemy sacrifice, seed pouch opening, and marketplace sales; XP bar with current level shown in the HUD header; gardener level gates marketplace listing slot unlocks and farm expansion upgrades
- **Flower discovery achievement tiers** — cumulative discovery milestones (discover 5 / 10 / 25 / 50 / … species) replace the old harvest-count achievements; tiers auto-advance as you fill out the Floral Codex
- **Gems** — new currency awarded from achievements and daily task completion streaks; gem balance shown in the HUD alongside coins

#### Daily Tasks & Events
- **Daily Tasks** — a set of quests refreshes each day with per-action progress tracking (plant X seeds, harvest X blooms, sell X flowers, etc.); completing all tasks claims coins and gems via the `daily-complete` edge function
- **Events system** — live timed events of two types: check-in events (log in daily for a reward) and collection quests (submit specific flowers); each event card shows its start and end dates so you always know how long it runs
- **Sakura Blossom Event (May 10 – May 31)** — the first seasonal event; check in daily to earn rewards; features an exclusive **Sakura Blossom** flower unobtainable outside the event window

#### Login Page & Title Screen
- **Title screen "Enter Garden" flow** — signed-in users land on the login page and must tap Enter Garden before the game loads; all audio, weather ambience, and level-up SFX are gated behind this action so nothing plays prematurely
- **Animated flower grid background on login page** — pastel pixel art flowers tile the background; polished petal drop and logo sprite animations complete the look
- **Google sign-in via popup** — OAuth flow opens in a small popup window instead of a full-page redirect; the main window reloads automatically after sign-in completes without losing context
- **Auth loading screen animated progress bar** — a labelled multi-phase progress bar and loading text replace the plain spinner while the game state loads after sign-in

#### Garden & UI Quality of Life
- **Notification consolidation + Clear All** — duplicate toasts for the same event (e.g. repeated harvests of the same flower) merge into a single accumulating pill counter; a Clear All button dismisses every active notification at once (#224)
- **Rarity filter + sort in SeedPicker** — filter the seed list by rarity and sort by name or rarity tier before planting; applies to both the single-plot picker and the Plant All flow (#263)
- **Bulk plant/harvest filter modal** — a filter sheet lets you select rarity tiers and flower types to include before Plant All or Collect All runs (#262)
- **Per-rarity select-all / clear on Sacrifice screen** — quick-action buttons per rarity row let you instantly select or deselect all blooms of that rarity in the alchemy sacrifice view (#251)
- **Slot lock on seed shop listings** — tap the lock icon on any shop slot to prevent it from being replaced when the shop restocks (#238)
- **Auto-planter pause/resume toggle** — pause and resume the auto-planter from its gear tooltip without removing it from the farm (#245)
- **Balance Scale flip countdown in gear tooltip** — the tooltip now shows a live countdown to the next boost/penalty phase flip alongside the current phase indicator (#239, #240)
- **Weather effects toggle in settings** — disable animated weather overlays (rain particles, lightning, snow) for a cleaner garden view on lower-powered devices

### Changed
- **Font switched to Pixelify Sans** — all UI text now uses the Pixelify Sans variable font for a cohesive pixel-art aesthetic
- **Settings modal consolidated** — visual appearance settings and the new audio settings live in a single redesigned panel; the Sign Out button has been moved into settings
- **Guest play removed** — an account is now required; the guest play option is no longer shown on the login page
- **Login page subtitle** updated to Sakura Blossom Event; **HUD flower icon** updated to the Sakura Blossom sprite
- **Notification badges unified** — all tab nav badges are now primary-colored pixel-corner dots (replaced mixed emoji/number styles)
- **Settings "Sign out" renamed to "Go to title screen"** — the action returns you to the login page without signing out of your account
- **Balance — Seed Pouch upgrade cost** increased from 2× to 3× of the previous tier (applies to all base and typed/elemental pouches)
- **Balance — Heirloom Charm upgrade cost** increased from 2× to 3× of the previous tier
- **Balance — Infuser I cost** increased from 2 to 3 Universal Essence; Infuser II–V upgrade cost increased from 2× to 3× of the previous tier

### Fixed
- **Ghost gear after expiry** — expired gear is now removed from both client state and the DB atomically; gear tiles no longer linger as un-interactable ghosts after their timer runs out (#242)
- **Shop restock blink** — a rapid restock poll race no longer briefly blanks the shop grid between the old and new listings (#243)
- **Heirloom Charm duplication exploit** — `plant_timings` are now synced when an Eclipse Tonic is applied so the server can correctly reject a second charm activation on the same plant
- **Harvest and generic toasts looping** — removed `count` from the dismiss timer dependency array so accumulated pill toasts clear correctly instead of re-triggering on every state change
- **Notification mousedown closing plant tooltip** — tapping a notification no longer dismisses an open plot tooltip behind it (#225)
- **"Plot already occupied" race condition** — the seed/bloom picker now reads the live state ref instead of a stale render closure, so plots filled by the auto-planter or harvest bell between renders are correctly blocked; the picker auto-closes if its target plot becomes occupied (#1A)
- **Level-up SFX firing on sign-in** — gardener level jumps from the initial default to the real saved value on cloud load; the SFX is now gated behind actually entering the garden
- **Garden music playing on login page** — audio now starts only after the player clicks Enter Garden, not when auth resolves
- **Login music not playing on fresh page load** — audio context creation and first track selection now happen synchronously on Enter Garden
- **Google sign-in popup not reloading** — the opener window now correctly reloads after the popup OAuth flow completes so the session is picked up
- **Loading screen flash before login** — the auth-resolving spinner is replaced with a subtle inline pulse on the login page itself; no intermediate full-screen flash
- **Crossbreeding claim gated on non-existent achievement tier** — the Master Botanist tier referenced in the claim gate did not exist on the client; gating now checks `discoveredRecipes` correctly
- **Achievement stats not reaching DB** — periodic cloud saves and a pre-claim flush were added so stats accumulated between auto-saves are not lost before an achievement is claimed

---

## [v2.3.8] — 2026-05-05 — Gear Removal & Progress Fixes

### Fixed
- **Progress bar no longer snaps when a growth-multiplier gear is removed or expires** — removing or expiring a Balance Scale or sprinkler mid-growth previously caused boosted plants to jump backward and slowed plants to jump forward; the tick now uses a time-weighted multiplier that correctly amortises the boost/slow over the exact window it was active (#222)
- **No more 400/409 errors when rapidly re-placing gear in the same cell** — `gear-action:remove` now retries on save conflicts (matching the existing retry in `gear-action:place`), so a remove → immediate re-place sequence no longer fails with "Cell already has gear" or "Save was modified by another action"

---

## [v2.3.7] — 2026-05-04 — Harvest All Fix & Codex New Filter

### Added
- **Codex "New" filter** — a ✦ New tab on the Codex status bar shows only newly discovered species; the tab has a red dot indicator, auto-resets to All once all entries are acknowledged, and is disabled when there is nothing new

### Fixed
- **Harvest All no longer drops blooms** — plants without a `plant_timings` row (e.g. planted via Plant All) were being cleared from the garden without their bloom being added to inventory; all blooms are now correctly awarded regardless of how the plant was planted

---

## [v2.3.6] — 2026-05-03 — Eclipse Tonic Fixes & Recipe Rebalance

### Changed
- **Balance — Heirloom Charm I recipe** — now costs 8× Fairy + 4× Stellar + 4× Arcane Essence (was 4× Fairy + 4× Stellar)
- **Balance — Moon Vial I recipe** — now costs 8× Lunar + 4× Arcane Essence (was 8× Lunar only)
- **Balance — Rainbow Vial I recipe** — now costs 2× Universal Essence (was 1× Universal)
- **Balance — Gold Vial I recipe** — now costs 8× Solar + 8× Stellar Essence (was 8× Solar only)

### Fixed
- **Eclipse Tonic now applies immediately** — growth bars and gear timers update the moment the tonic is used; no page refresh required
- **Eclipse Tonic no longer silently fails** — the edge function now retries up to 3 times on save conflicts, preventing rollbacks during concurrent actions
- **Eclipse Tonic now advances gear timers** — `placedAt` and `crossbreedStartedAt` are shifted so sprinklers, Balance Scales, and other gear are fully affected
- **Eclipse Tonic no longer appears in plot tooltips** (#215) — it targets the whole farm and is not a per-plot consumable

---

## [v2.3.5] — 2026-05-03 — Toast Notifications & Balance

### Added
- **Loss/gain toast notifications** — pill toasts now fire for every inventory change: planting seeds (red), harvesting blooms (red), placing gear (red), using a shovel (red), applying consumables (red), buying seeds or supply items (green), and spending crafting ingredients (red)
- **Plant All loss toasts** — each seed species planted via Plant All shows a dedicated loss toast; repeated plants of the same species accumulate into a single count pill

### Changed
- **Golden Veil renamed** — the Midas Sprinkler was incorrectly named "Gold Vial"; it is now correctly called "Golden Veil"
- **Balance — Vials & Heirloom Charms rarity nerf** — all mutation vials and Heirloom Charms now require the plant's rarity to be **strictly below** the consumable's tier; same-rarity plants are no longer valid targets (e.g. a Rare Frost Vial I no longer works on Rare plants)
- **Balance — Seed Pouch upgrade cost increased** — upgrading any Seed Pouch (base or typed/elemental) now costs **4×** of the previous tier instead of 3×

### Fixed
- **iOS inputs no longer zoom the page** — input and textarea elements are set to 16px on mobile to prevent the browser auto-zoom on focus
- **Weather Forecast panel scrolls correctly on mobile** — header is now sticky so it stays visible while scrolling through a long forecast list

---

## [v2.3.4] — 2026-05-02 — Hotfix

### Fixed
- **Lawnmower, Aqueduct & Balance Scale crafting now works** — all three gear families were missing from the server-side recipe tables; attempts to craft them returned a 400 error
- **Heirloom Charm I craft recipe corrected on server** — `alchemy-craft` edge function still required 4× Grove Essence instead of 4× Fairy Essence, causing crafts to fail
- **Gear expiry toast no longer overlaps other notifications** — the gear expiry banner is now part of the shared notification stack and stacks vertically alongside shop restock and craft completion banners (#191)

---

## [v2.3.3] — 2026-05-02 — Quality of Life & Fixes

### Added
- **Inventory search bar** — each inventory tab (Seeds, Blooms, Supplies, Consumables, Essences) now has a search bar so you can quickly find items by name
- **Inventory header counts consumables and essences** — the header line now shows total consumable and essence counts alongside seeds, blooms, and supplies
- **Heirloom Charm harvest shows a seed toast** — harvesting a plant with an active Heirloom Charm now pops up a separate "+1 Seed" notification alongside the bloom notification
- **Codex "newly discovered" badges sync across devices** — acknowledged entries are now persisted to the cloud save; opening a species card on one device clears the badge on all others

### Changed
- **Heirloom Charm I recipe updated** — ingredient changed from 4× Grove Essence to 4× Fairy Essence (4× Stellar Essence unchanged)

### Fixed
- **Heirloom Charm now correctly returns the seed on harvest** — the seed was only added server-side but never applied to the optimistic client state, so the inventory never updated until the next page reload
- **Heirloom Charm no longer creates a duplicate bloom row** — harvesting a charm plant produced two separate bloom rows in inventory due to a `null` vs `undefined` mutation mismatch; normalised to `null` on both sides
- **Plot tooltip no longer offers Heirloom Charm on a plant it's already applied to** — the charm option is now hidden once `heirloomActive` is set on the plant
- **Shop no longer flickers after restock when reload-from-cloud fires** — `reloadFromCloud` was doing a raw state replacement that bypassed the shop forward-only guard; it now routes through `mergeServerResult` so a cropstick poll or error-recovery reload can never stamp old DB shop data over a freshly-restocked client shop
- **Codex badges no longer flood all discoveries on a new device** — the acknowledged set was bootstrapped before the cloud save loaded, capturing an empty `discovered` list and permanently marking every species as unseen on that device

---

## [v2.3.2] — 2026-05-02 — Bug Fixes & Balance

### Changed
- **Balance Scale reworked** — range fixed to 1 cell each side for all tiers; boost and slow values now scale per tier: Scale I 4×/0.5× (avg 2.25×), Scale II 6×/0.33× (avg 3.165×), Scale III 8×/0.25× (avg 4.125×)
- **Shop seed prices display cleaner** — prices are now floored to 2 significant figures (e.g. 1,234 → 1,200)
- **Scarecrow description corrected** — now correctly says "Blocks all mutations" (it has always blocked gear mutations too, not just weather)
- **Fan description corrected** — effect rate now correctly reads "each hour" instead of "each minute"
- **Garden Pin description corrected** — now references Lawn Mowers instead of Auto-Planters

### Fixed
- **Harvesting v2.3.1 flowers no longer fails** — harvest edge function was missing all 38 v2.3.1 species, returning "Unknown species" 400 errors on every harvest
- **Marketplace price history shows the correct mutated price** — listing base_value now includes the mutation multiplier so the chart reflects the actual listed price
- **Composter now generates fertilizer during offline ticks** — composter logic was client-side only; it now also runs in the offline cron processor
- **Plot tooltip no longer shows Forge Haste or Seed Pouches** — speed boosts and seed pouches don't target individual plots and are now excluded from the per-plot consumable picker
- **Plot tooltip scrolls when many consumables are present** — tooltip no longer extends off-screen on mobile with large consumable inventories
- **Shop no longer flickers after restock** — stale server responses arriving after a client-side shop reset no longer overwrite the fresh shop list

---

## [v2.3.1] — 2026-05-01 — Flower Expansion & Fan Fix

### Added
- **38 new flowers** — added across common, uncommon, rare, legendary, and mythic rarities; all edge functions (`alchemy-sacrifice`, `botany-convert`, `alchemy-craft-seed`, `use-consumable`, `gear-action`) updated to recognise the new species
- **Unknown seeds reveal at bloom** — when an unknown plant (???) reaches bloom stage, the plot tooltip now shows the real species name, emoji, rarity, and type badges; no Magnifying Glass required

### Changed
- **Weather mutation rates reduced ~1/3** — all per-tick rates cut by approximately a third; Rain / Tornado ~23% over the full event, Heatwave / Cold Front ~11%, rare weather events (Golden Hour, Prismatic Skies, Star Shower) ~5%, passive Moonlit Night ~3.5% over 10 hours; Giant bloom flat chance reduced from 8% → 5.3%
- **Mutation sell multipliers rebalanced** — Rainbow raised to 5×; Wet reduced to 1.1×; Windstruck reduced to 0.7×; Shocked restored to 2.5×; client and server values now fully in sync
- **Fan now strips Wet mutation only** — previously stripped any non-Windstruck mutation; now exclusively targets Wet; Windstruck application uses a separate lower rate (~15%/hr flat across all tiers)
- **Prismatic Skies weather weight reduced** — selection weight cut from 10 → 3, making Rainbow mutation events significantly rarer during daytime

### Fixed
- **v2.3.1 flowers now award correct coins on sell** — `shop-action` was missing all 61 new species from its sell-value table, causing sells to silently remove the bloom while adding 0 coins
- **Craft duration display shows exact time** — recipe cards now show e.g. "1m 30s" instead of rounding up to "2 min"; hours display similarly (e.g. "1h 30m" instead of "1h")
- **Weather time gating now uses real Eastern Time** — `advance_weather` previously defaulted to noon UTC for all cron calls, permanently locking out Golden Hour and Star Shower; the function now extracts the actual ET hour server-side so all three time-restricted weathers fire in their correct windows
- **Fan and sprinklers now run during offline cron ticks** — fan (Wet strip / Windstruck), regular sprinklers (Wet), and all 6 mutation sprinklers were silently skipped by the offline tick processor; all now run at correct per-minute rates
- **Aegis no longer blocks sprinkler mutations offline** — the offline tick used a single `hasShield` flag for both Scarecrow and Aegis; Aegis now correctly blocks weather mutations only, while Scarecrow continues to block all gear mutations
- **Expired marketplace listings now mailed back to seller** — previously the expire cron directly modified `game_saves` inventory; it now inserts a "Listing Expired" mailbox entry so the seller receives the item through the standard mailbox flow
- **Marketplace expire cron no longer returns 401** — the GitHub Actions workflow was passing `CRON_SECRET` as the Bearer token; Supabase's gateway rejected it as an invalid JWT before the function ran; fixed by using the service role key as Bearer and routing `CRON_SECRET` to a dedicated `x-cron-secret` header
- **Fan no longer strips Windstruck** — the strip branch was matching Windstruck (stored as a string) and incorrectly removing it; fan now leaves any plant already carrying Windstruck alone
- **Fan no longer re-applies Windstruck to a plant that already has it** — the apply-Windstruck branch fired even when the plant was already Windstruck; apply now only runs when the plant has no mutation at all
- **Profile garden stage emoji** — the read-only garden on player profiles now shows the correct seed / sprout / bloom emoji for each growth stage instead of always showing the seed emoji for non-bloomed plants
- **Profile garden Exalted gear bar** — the gear expiry progress bar for Exalted-rarity gear in the read-only profile garden is now the correct slate/white color instead of black

---

## [v2.3.0] — 2026-05-01 — The Alchemy & Crafting Update

### Added

#### Alchemy & Essence
- **🧪 Alchemy system** — sacrifice harvested blooms to earn Essence tokens (one type per flower type, plus Universal Essence)
- **AlchemyTab** — replaces the old Botany conversion tab; sacrifice view with multi-select rarity/type filters and essence preview
- **🧬 Universal Essence** — craft from 12 elemental essences (1 of each); Prismatic rarity with rainbow styling
- **Essence Bank** — shows all 12 elemental + Universal essence counts; prismatic styling for Universal

#### Crafting Queue
- **⚒️ Time-gated Crafting Queue** — all crafting (gear, consumables, attunement) is now time-gated through a queue; Forge tab renamed to Craft
- **Crafting slot upgrades** — start with 1 slot; buy up to 4 parallel craft slots
- **Bulk crafting** — craft 1–50× of any recipe at once; cost and duration scale by quantity
- **Craft ready banner + badge** — amber navbar badge shows count of claimable crafts; banner notification fires when a craft completes
- **Fertilizer crafting** — craft Basic → Miracle fertilizers in a chain (Basic: 1 minute)
- **Universal Essence in Craft tab** — dedicated Other tab with time-gated Universal Essence craft
- **Crafting queue search bar** — filter the recipe grid by name

#### Attunement Queue
- **⏳ Attunement Queue** — time-gated essence-mutation flow; applies a mutation to a bloomed plant over time; mutation outcome hidden until collected (surprise reveal)
- **Attunement slots** — start with 0; buy up to 4 slots ($50k–$700k)
- **Emerald navbar badge + completion banner** — badge counts claimable attunements; banner fires on completion
- **Resonance Draft boost consumable** — halves all active attunement craft durations

#### Cross-Breeding (Cropsticks)
- **🌿 Cropsticks gear** — place on adjacent plots with infused blooms to start a cross-breed; passive system requiring no cron
- **Infuser system** — apply an Attunement Crystal to a bloomed plant to mark it as a cross-breed participant
- **Deterministic 1-hour progress bar** — shows accurate time-to-breed countdown instead of per-hour RNG rolls
- **Cross-breed particles** — visual effect fires when a cross-breed completes
- **Cross-breed tooltip countdown** — hover Cropsticks plot to see time remaining

#### Seed Pouches
- **🎁 Seed Pouches** — craftable mystery seeds; open to receive a random flower seed of a matching rarity
- **12 element-typed pouches × 5 tiers** — one pouch per flower type, each tier covering a rarity band
- **Generic Universal Pouch** — costs 1 Universal Essence; mystery seed from any rarity

#### Consumables
- **🥄 Shovel** — required to dig up a growing (non-bloomed) plant; one-use; pinned plants block shovel use
- **📏 Ruler** — reveal the exact growth-speed multiplier active on a plant
- **🧪 Mutation Vials (7 types)** — Frost, Ember, Storm, Moon, Golden, Rainbow, Giant — directly apply a mutation to a bloomed plant; blocked if the bloom already carries a mutation (use Purity Vial first)
- **🧼 Purity Vial** — remove an existing mutation from a bloomed plant; tiered I–V

#### Active Boost Consumables
- **⚡ Verdant Rush** — temporarily doubles farm growth speed (2×)
- **🔥 Forge Haste** — halves active crafting queue durations
- **🎵 Resonance Draft** — halves active attunement queue durations

#### Gear
- **🚜 Lawnmower (I–III)** — directional harvest bell; harvests bloomed plants in a line with a pollen-cloud animation
- **⚖️ Balance Scale (I–III)** — alternates between 3× growth boost and 0.5× growth penalty every hour; covers a radius of plots
- **🌊 Aqueduct (I–III)** — bidirectional line growth sprinkler; boosts cells in both directions along the chosen axis (1/2/3 cells each way)

#### New Flowers & Codex
- **10 new flowers** — added across all rarities to ensure every flower type has at least one species per rarity tier
- **Codex type filter** — multi-select row of all 12 flower types (OR semantics) filters the codex list
- **Codex unseen badge** — persistent red dot per newly discovered entry; clears on expand; stored in localStorage
- **Codex smooth animation** — entry expand/collapse uses CSS grid `0fr → 1fr` transition
- **Codex growth times + sell values** — shown at the top of each expanded codex entry

#### Social & Profile
- **👥 User presence indicators** — online/offline dot on leaderboard entries and profile cards
- **ReadOnlyGarden sync** — profile view now shows all PlotTile effects (sprinkler drops, fan gusts, lawnmower animation, etc.) matching the live garden

#### Guest UX
- **Sign-in prompt modal** — guests tapping an empty plot, clicking Buy, or clicking Upgrade now see a friendly sign-in prompt instead of silent failure

#### Marketplace
- **Consumables listing tab** — consumable items (vials, boosts, etc.) can now be listed and purchased on the Marketplace
- **Gear listing tab** — gear items can be listed and purchased on the Marketplace
- **Fertilizer listings** — fertilizers retain their own listing path on the Marketplace

#### Offline & UI
- **"Crafts ready" offline overlay row** — the offline-return banner now includes a count of crafts ready to collect
- **Inventory consumable rows** — consumable items styled to match the seeds/blooms format; Prismatic items get the rainbow-tile treatment

---

### Changed
- **AlchemyTab replaces Botany** — seed pouches (crafted in AlchemyTab) replace direct rarity conversion; old Botany conversion tab removed
- **Craft tab always shows slots** — crafting slot list is always visible; an upgrade slot ghost card appears at the end when max isn't reached
- **Marketplace no longer lists Seeds** — Seeds tab removed from the Create Listing modal; Supplies split into separate Consumables and Gear tabs
- **Scarecrow rework** — now strips weather-caused mutations with a chance instead of fully blocking them; Aegis added as a weather-only mutation shield
- **Magnifying Glass rework** — collapsed from 5 tiers to a single Rare item; works on any rarity plant; always shows the rarity label in the species-reveal tooltip
- **Garden Pin** — collapsed from 5 tiers to a single non-tiered item; bypasses rarity gate; requires pin removal before harvesting
- **Weather mutation rates** — reduced to approximately 2/3 of previous rates across all weather events
- **Supply shop gear prices** — gear returned to supply shop at 2× craft price; meaningful margin over crafting remains
- **Supply shop prices rebalanced** — fertilizers, gear, and magnifying glass prices adjusted across the board
- **Gear crafting durations halved** — all gear craft times cut in half
- **Crafting recipe costs rebalanced** — essence and ingredient costs adjusted across all tiers
- **Seed pouch rarity rates capped** — pouch outcomes capped at 1 rarity tier above the pouch tier at 5% chance
- **Tile seed/sellValue ratio adjusted** — Common 0.65 → 0.85 (Prismatic) for better economy scaling
- **Crop breed duration** — Cropsticks cross-breed fixed at 1 hour
- **Mutation vials** — reworked from chance-boosters to direct mutation applicators
- **Purity Vial** — reworked from mutation-shield to mutation-remover
- **Fertilizer rarity labels** — supply shop and inventory now show rarity label on fertilizer items (e.g. "Rare · 1.5× speed")
- **Alchemy tab font/style** — aligned with Codex style (uppercase filter buttons, consistent sizing)

---

### Fixed
- **Mutation vials blocked on blooms with existing mutations** — all 7 mutation vial types are now hidden from the consumable picker and rejected by the server when the bloom already carries a mutation; Purity Vial must be used first
- **Growth stage reverting after gear removal** — removing a sprinkler or lamp from a nearly-bloomed plant no longer rolls the stage back to sprout; stage transitions are permanently stamped before gear changes, and `sproutedAt`/`bloomedAt` timestamps act as floors that can never be walked back
- **Fertilizer applicable to bloomed plants** — applying fertilizer to a bloomed plant is now blocked on both client (picker hidden) and server (400 error)
- **Harvest blocked on cross-breed source plants** — plants actively used as a Cropsticks cross-breed source can no longer be manually harvested mid-breed
- **Cancel button shown on completed crafts** — the cancel button is now hidden once a craft is done; only collect is available
- **Pouch toast shows rarity name and color** — seed pouch open notification now shows the rarity name in the correct rarity color instead of the raw flower name
- **Codex duration display for 24h+ tiers** — growth time in codex entries now shows `Xd Xh Xm` for all tiers including those with 24h+ durations
- **Cross-breeding reliability** — cross-breed now works for all rarities; falls back to a deterministic non-recipe bloom when no matching recipe exists; best-pair selection uses a stable algorithm
- **Collect All fires harvest popup** — batch harvesting via Collect All now triggers the bloom harvest notification the same as single-plot harvests
- **Emoji compatibility (Windows)** — replaced broken Emoji 13+ glyphs and deduplicated bloom emoji with Windows-safe alternatives
- **Craft tab Other filter** — the Other sub-tab no longer incorrectly shows gear and consumables alongside universal essence recipes
- **Codex undiscovered entries not leaking** — searching the codex by internal species ID no longer reveals undiscovered flowers

---

## [v2.2.5] — 2026-04-29 — Reliability Hotfix

### Fixed
- **Sell All eating concurrent harvests** — the rollback path snapshotted `current.inventory` at sell-start, so any flower the user harvested during the sell roundtrip would be wiped if the sell server-call failed. Rollback is now incremental (`rollbackSellAll`): it only undoes the specific blooms sold (and the specific coin delta), leaving any concurrent harvests / inventory changes intact. Closes the "items disappear, no money" report cluster.
- **Per-card sell buttons (single + full stack)** — same snapshot-rollback bug existed in `InventoryItemCard.tsx`'s `handleSellOne` and `handleSellAll`. Both now use the same incremental `rollbackSellAll` helper.
- **Plant All wiping successful plants on a single failure** — the loop awaited each `edgePlantSeed` and rolled back the *entire* batch with `update(prev)` if any single call failed, even though earlier plants had already written to the DB. `handlePlantAll` now drives **per-plot** `perform()` calls (serialized through `harvestQueue`) with surgical rollbacks (`rollbackPlantOne`) that undo only the failing plot, leaving other successful plants and concurrent state changes alone. Closes the "plant all glitchy / planting not working" reports.
- **"Plot already occupied" stuck state after Plant All spam on slow connections** — when the server has a plant in a cell the client thinks is empty (a desync, usually caused by a network failure where the server wrote but the client never got the response and rolled back locally), the user was stuck unable to plant on that tile. Both `handlePlantAll` and the single-tile click flow now catch the "Plot already occupied" error, fire a local rollback, **and** trigger `reloadFromCloud()` to overwrite local state with the authoritative server view. Mirrors the existing auto-planter recovery pattern.
- **Plant All flicker — plants disappear after the first response and "re-plant" one at a time** — each plant-seed response was returning the server's `{ grid, inventory }` to perform's success-merge, which replaced the client's grid with the server's partial view (only plants up to that call's write moment). Every sibling call's optimistic plants were briefly wiped, then restored as later responses landed. `handlePlantAll` and `handleSeedSelect` now `return {}` from `serverFn` after the await, discarding the grid/inventory delta so the optimistic state stands. This matches the auto-planter's long-standing pattern.

### Refactored
- **Pure rollback helpers** — `rollbackSellAll(state, soldItems, earned)` and `rollbackPlantOne(state, row, col, speciesId)` extracted to `gameStore.ts`. Each is unit-tested against the bug-fix scenarios (concurrent-harvest preservation, per-plot isolation, push-new-entry on missing inventory rows, idempotence on already-empty plots) — 12 cases in `tests/unit/gameStore.rollback.test.ts`.

---

## [v2.2.4] — 2026-04-29 — Hotfix & Gear Polish

### Fixed
- **Sell All data loss** — selling all blooms is now a single atomic server write; previously N sequential calls with a shared catch block would roll back all blooms client-side even if some had already landed server-side, leaving players with no flowers and no coins
- **Harvest coin snap-back** — rapidly harvesting multiple plots no longer causes the coin counter to stutter or revert; the harvest response no longer returns the full server coin total, which was overwriting the client's optimistic running total from concurrent in-flight harvests
- **Sell All 400 on every call** — `sell_all` was added to the shop-action handler but accidentally omitted from the action allowlist, causing every Sell All request to be rejected before reaching the sell logic
- **Mutated flowers awarding coins on harvest** — mutations previously awarded `sellValue × (multiplier - 1)` coins at harvest time on both client and server; coins are now only gained by selling blooms
- **Harvest Bell and Auto-Planter stopping off-tab** — gear actions now keep running when the user navigates away from the Garden tab; Garden is always mounted (CSS-hidden when not active) so bell harvests and auto-plant events fire on any tab
- **Harvest popup not showing off-tab** — popup is now rendered at App level; bell auto-harvests trigger the notification even when the user is on Inventory, Shop, or Social
- **Own profile not updating in real-time** — the realtime subscription was skipped for your own profile; it now subscribes for all profiles including your own
- **Other players' profile not showing live gear effects** — profile page now re-runs `simulateOfflineGarden` every 5 seconds so plant growth and bell harvests are visible between server cron ticks
- **Auto-Planter spamming server on occupied plot** — when an offline cron tick pre-filled a cell, the auto-planter would retry indefinitely; the cell is now blocked until state resyncs from the server
- **Supply Shop concurrent buy protection** — the buy handler now reads `updated_at` before writing and performs a CAS check; a conflicting save (e.g. offline tick firing mid-buy) returns a clean 409 rollback instead of silently corrupting coins or inventory

### Changed
- **Harvest popup redesigned** — bloom emoji with mutation label inline (e.g. `+1 🌹 ✨ Golden`); harvesting the same flower rapidly accumulates into a single `+N` pill instead of duplicating; different species each get their own pill stacked on screen simultaneously

---

## [v2.2.3] — 2026-04-28 — Security Patch

### Security
- **timePlanted manipulation exploit closed (#126)** — a server-authoritative `plant_timings` table (no client write policy) now stores the real planting timestamp set by the server when a seed is planted; the harvest edge function validates bloom time against this instead of the client-writable `timePlanted` field in `game_saves.grid`, closing both the localStorage and direct REST PATCH attack vectors

---

## [v2.2.2] — 2026-04-28 — Mailbox & Bug Fixes

### Added
- **Claim All button** — collect every unclaimed mail item in one tap; claims run sequentially so no items are dropped (#127)

### Fixed
- **Mailbox real-time updates** — new mail now appears instantly while the mailbox is open, without needing to refresh or navigate away (#123)
- **Mailbox message text overflow** — long URLs and unbroken strings in gift messages no longer overflow the message card on narrow screens (#110)
- **Mail card stays open after collecting** — claiming a mail item now collapses the card automatically (#128)
- **Clear claimed mail persists** — claimed mail cleared via "Clear claimed" is now deleted from the server; it no longer reappears after navigating away and back (#112)
- **Leaderboard duplicate rank numbers** — players tied on coins no longer share the same rank number; ranks are always assigned sequentially (#113)
- **Profile page scroll position** — navigating to a player's profile from the leaderboard or mailbox now scrolls to the top of the page (#111)

---

## [v2.2.1] — 2026-04-28 — Security & Bug Fixes

### Security
- **Server-side mutation assignment** — harvest no longer accepts a client-supplied mutation ID; mutation type is now determined entirely server-side, closing the exploit where any mutation could be forced on any harvest
- **Codex discovery server-trusted** — client-supplied `discovered` arrays are no longer merged into the save; the server derives discoveries from the authoritative inventory, preventing fake codex completion
- **Marketplace ask price validated** — listing price is now coerced to a positive integer before the 5% fee is calculated; previously a NaN ask price caused the fee to floor to 1 coin
- **Clock skew tolerance tightened** — local saves dated more than 1 second in the future are rejected in favour of the cloud save (down from 30 s), closing the timestamp manipulation exploit
- **Gear duration-reset exploit fixed** — removing placed gear now destroys it with no refund; previously a player could remove gear just before expiry and redeploy fresh to reset the duration; composters still return stored fertilizers before removal

### Fixed
- **Sprinkler mutations not applying** — Scorched, Frozen, Shocked, Moonlit, Gilded, and Rainbow sprinkler mutations were silently failing and never applying to nearby bloomed plants
- **Gear tooltip mutation badge** — mutation sprinkler tooltips now correctly show which mutation type the sprinkler targets
- **Fan initial direction not applied (#103)** — the direction chosen in the placement picker is now saved to the server; it was previously discarded, leaving the fan directionless until manually reset via the tooltip
- **Fan tooltip direction not persisted** — changing fan direction from the plot tooltip now saves to the server and survives a page reload
- **Gear animations starting from origin (#106)** — all gear particle effects (sprinkler drops, fan gusts, bell sways, composter sparks, etc.) now appear mid-motion on placement instead of starting from the edge and traveling visibly from scratch
- **Plot tooltip growth time inaccurate under gear (#104)** — time remaining now correctly accounts for sprinkler and grow lamp speed boosts and updates live as weather and gear change
- **Sign-out losing Plant All progress** — sign-out now flushes all pending server writes before invalidating the JWT so in-flight operations are never dropped
- **Stale account data visible after sign-out** — signing in and immediately signing out no longer leaves the previous account's data on-screen
- **Single-session enforcement** — opening a second tab or device while signed in now disables saves on the older session to prevent data races; a banner prompts a refresh
- **Weather queue overwritten on new event** — advancing weather now correctly appends the next event to the forecast tail instead of replacing it
- **Marketplace expire edge function** — expired listings are now reliably cleaned up server-side and items correctly returned to the seller's inventory
- **Marketplace sold notification** — sellers now receive a mailbox notification when a buyer purchases their listing
- **Mail rarity border** — mail items no longer show a rarity-coloured border
- **Mail accordion** — opening a mail item now automatically closes any previously expanded mail

### Changed
- **Rain and thunderstorm Wet mutation** — chance raised to ~70% over the event duration (was ~50%)
- **Tornado Windstruck mutation** — now ~70% chance over the tornado's duration; no longer instant
- **Moonlit Night mutation** — chance reduced to ~15% over a 10-hour night (was ~50%)
- **Wet mutation sell-value multiplier** — reduced from 1.5× to 1.25×
- **Thunderstorm Shocked mutation** — can only apply to plants already carrying Wet; the direct unmutated → Shocked path has been removed
- **Gift rate limiting** — per-sender gift rate is now capped to prevent leaderboard farming via alt accounts

---

## [v2.2.0] — 2026-04-27 — The Gear Update

### Added
- **⚙️ Gear system** — a new layer of placeable items for your farm; place gear on any plot and it affects nearby plants for its duration
- **🏪 Supply Shop** — new shop tab that sells fertilizers and gear; items roll by rarity tier and restock independently of the seed shop
- **🚿 Regular Sprinklers (3 tiers)** — speed up nearby plants and have a chance to apply the Wet mutation
  - Rare 🚿: 1.5× growth, cross radius (4 plots), 1 hour
  - Legendary 🚿: 1.75× growth, 3×3 radius (8 plots), 2 hours
  - Mythic 🚿: 2× growth, diamond radius (12 plots), 4 hours
- **🧪 Mutation Sprinklers (6 types)** — each targets a specific mutation; 50% chance per hour across a 3×3 area, 2-hour duration
  - Heater ♨️ → Scorched (Legendary)
  - Cooler 🧊 → Frosted (Legendary)
  - Generator 🔋 → Shocked — only applies to Wet plants (Mythic)
  - Crystal Ball 🔮 → Moonlit (Mythic)
  - Gold Vial 💰 → Gilded (Exalted)
  - Kaleidoscope 🔭 → Rainbow (Prismatic)
- **💡 Grow Lamp** — boosts growth speed during night periods (dusk / night / midnight); stacks with sprinklers; Uncommon 1.2× (4 h) and Rare 1.5× (8 h)
- **🧹 Scarecrow** — fully blocks weather mutations on nearby plants while active; sprinkler mutations still apply; Rare (4 h) and Legendary (8 h)
- **🧺 Composter** — generates a fertilizer every time a nearby plant blooms; stores up to 10 (Uncommon, 4 h) or 20 (Rare, 8 h); collect stored fertilizers from the plot tooltip
- **💨 Fan** — point it in a direction; each tick has a chance to strip the mutation from a bloomed plant in its path, or apply Windstruck if there is none; Uncommon (2 tiles, 2 h) and Rare (3 tiles, 4 h)
- **🔔 Harvest Bell** — automatically harvests bloomed plants in range, even while offline; Rare cross radius (4 h) and Legendary 3×3 radius (8 h)
- **🌾 Auto-Planter** — automatically plants seeds from your inventory into empty cells in a diamond area, even while offline; Prismatic only, 12 hours
- **Gear inventory tab** — owned gear is displayed in a dedicated tab inside the Inventory page, separate from flowers and seeds
- **Plant indicators** — active gear effects show as small badges on plots (sprinkler boost, mutation chance, lamp glow, scarecrow shield, etc.)
- **Gear in plot tooltip** — the tooltip for a plot now shows any gear placed on it with its name, emoji, and time remaining
- **Gear expiration** — placed gear automatically expires and is removed when its duration runs out
- **Fan direction picker** — a compass UI appears when placing a Fan so you can choose which way it blows
- **Profile gear slots** — your active gear is displayed on your public profile with slot animations
- **Supplies on Marketplace** — fertilizers and gear can now be listed and purchased on the Marketplace
- **Price history for supplies** — tap any supply listing to see its recent sale price history, matching the flower chart
- **Flower types** — each flower species now has a type category (e.g. Wild, Tropical, Garden) shown in the Codex and seed picker
- **App settings** — new settings panel accessible from the profile page; includes fertilizer badge display toggle and UI theme selection
- **UI themes** — choose from multiple color themes in settings
- **Inventory tabs** — inventory is now split into Flowers, Seeds, and Gear sub-tabs for easier browsing
- **Tabulated seed picker** — the seed picker when planting is now organised into tabs
- **Notification badges** — tab nav shows a badge count for unread mailbox items and unclaimed gifts
- **User presence** — see whether friends and profile visitors are currently online

### Changed
- **Botany conversion rates reduced** — tiers now require 3 / 4 / 5 / 5 / 6 / 7 blooms (Common → Exalted), down from a flat 5× across the board
- **Auto-Planter radius & duration** — now covers a diamond-shaped area (12 plots) and lasts 12 hours, down from a 5×5 square over 24 hours
- **Offline tick cron** — fires every minute instead of every 15 minutes for more accurate offline progress

### Fixed
- **Botany Convert All no longer deletes blooms** — if the server call fails mid-batch, blooms are now correctly restored; the button also cools down for 5 seconds before retrying
- **Weather permanently frozen after Clear** — the `advance_weather` database function was silently failing under Row Level Security; it now runs with correct permissions and weather advances reliably again
- **Kaleidoscope missing prismatic border** — the rainbow animated border and glow now correctly appear on the Kaleidoscope in the inventory and supply shop
- **Harvest Bell and Auto-Planter offline tick accuracy** — both gear types now process correctly during offline catch-up ticks
- **Weather queue resetting on new event** — queued weather events no longer get wiped when a new event is generated
- **Offline tick cloud sync** — the offline tick state is now reliably written back to the cloud after being applied
- **Settings no longer bleed into profile gardens** — changing your settings previously caused other players' profile gardens to re-render with your preferences
- **Grow Lamp dual rarity display** — the Grow Lamp no longer shows two rarity borders when placed
- **Rarity borders on fertilizers** — fertilizer items in inventory and shop now display the correct rarity border colour

---

## [v2.1.6] — 2026-04-27 — Bug Fixes

### Fixed
- **Plot tooltip hidden behind sticky nav** — tapping a plot near the top of the garden on mobile now opens the tooltip below the plot instead of behind the navigation bar

---

## [v2.1.5] — 2026-04-27 — Mobile UX

### Added
- **📱 Swipe navigation** — swipe left or right to move between tabs on mobile; swipe also works within the Shop (Seeds ↔ Fertilizers) and Social sub-views
- **Slide animations** — switching tabs slides the incoming view in from the direction you're navigating; sub-views inside Social and Shop animate independently so the sub-nav stays stable
- **🌿 Shop sub-tabs** — Seeds and Fertilizers are now separate tabs inside the Shop, each with its own grid and empty state
- **Sticky header & nav** — the header and navigation bar stay pinned to the top of the screen while you scroll

### Changed
- **Day/night transitions** — the ambient tint now cross-fades smoothly over 3 seconds instead of snapping instantly when the period changes

---

## [v2.1.4] — 2026-04-27 — Gifting Fixes

### Fixed
- **Coins awarded on gift** — gifting a flower no longer runs the sell logic; the item is removed from inventory with no coin change
- **Gift duplication on reload** — send-gift edge function now atomically deducts the item from the sender's DB inventory and inserts the gift row in a single server call; a page reload between steps can no longer leave the item in both places
- **Can gift a listed item** — server validates the item exists in the sender's DB inventory before the gift is created, closing the stale-client-state loophole
- **Gifted flowers blocked from Botany** — claim-gift edge function now writes the flower directly to the receiver's DB inventory; it's available for Botany immediately without waiting for an auto-save
- **Mutation emoji missing on friend cards** — friend profile flowers in the Social → Friends tab now show the mutation emoji overlay, matching the leaderboard

---

## [v2.1.3] — 2026-04-27 — Marketplace & Garden

### Added
- **🌱 Seeds in Marketplace** — seed items can now be listed and purchased; seed listings display the seed emoji and a "Seed" label to distinguish them from blooms
- **⚡ Real-time listing sync** — new listings appear instantly for all browsers; sold or cancelled listings disappear without a page refresh (Supabase Realtime Postgres Changes)
- **🗑 Remove planted flower** — tap any growing (non-bloomed) plant to open its tooltip and remove it; the seed is returned to your inventory. Bloomed plants must still be harvested
- **Tooltip viewport clamping** — plot tooltip no longer clips off the left or right screen edge on mobile; it measures its position before first paint and nudges itself into view

### Fixed
- **Marketplace race condition** — buying a listing that another player just purchased now shows a friendly "just sold" message and removes the phantom entry, rather than throwing an error

---

## [v2.1.2] — 2026-04-27 — Bug Fixes & UI

### Fixed
- **Shop "Flower not in stock" errors (final fix)** — if the post-restock server sync failed silently, the buy handler now auto-resyncs the shop and retries once before rolling back; no page refresh needed

### Changed
- **🏪 Marketplace moved into Social tab** — all player-to-player features (Search, Friends, Gifts, Ranks, Market, My Profile) are now under one tab; main nav reduced from 7 tabs to 6

---

## [v2.1.1] — 2026-04-27 — Bug Fixes

### Fixed
- **Collect All inventory trickle** — harvested blooms now appear in inventory all at once instead of one by one; each server response was overwriting the optimistic inventory with the DB's partial state
- **Harvest rollback now undoes inventory** — a failed harvest correctly removes the flower that was optimistically added, rather than leaving a ghost item
- **Shop "Flower not in stock" errors** — shop restock sync is now queued before any buy, eliminating the race where a buy fired before the new shop was written to the server
- **Stale fertilizer multipliers in harvest function** — server-side bloom check now uses the correct multipliers (Basic 1.1×, Advanced 1.25×, Premium 1.5×, Elite 1.75×, Miracle 2×)

---

## [v2.1.0] — 2026-04-27 — Marketplace

### Added
- **🏪 Marketplace** — buy and sell harvested flowers with other players; all active listings are visible to everyone
- **Listing slots** — start with 0 slots; unlock first slot for 10,000 coins, then 50k → 150k → 350k → 650k, max 5 slots
- **5% listing fee** — charged upfront when creating a listing; non-refundable regardless of outcome
- **48-hour expiry** — unsold listings expire automatically and the flower is returned to your inventory (hourly GitHub Actions sweep)
- **Price history chart** — expand any listing to see a Recharts line chart of the last 30 sale prices with a dashed base-sell-value reference line
- **My Listings tab** — view active listings with expiry countdown, cancel to reclaim the item, and browse sold/expired history
- **Browse filters** — search by flower name, filter by rarity, sort by newest / price ascending / price descending
- Seller credits are applied atomically via `add_coins_to_user` DB function; buyer save and seller credit run in parallel

### Fixed
- **Botany race condition (#61)** — simultaneous conversions no longer produce errors; perform calls are serialized so concurrent DB writes can't race each other
- **Forecast slots 5–8 showing "Pending" (#62)** — SQL forecast loop now generates enough entries to fill all 8 unlocked slots
- **Time-restricted weather outside allowed windows** — Golden Hour, Prismatic Skies, and Star Shower now gate correctly using Eastern Time on both client and server
- **`advance_weather` inserting NULL weather type** — rewrote `_pick_weather` SQL function with explicit per-type variables to eliminate the NULL constraint violation
- Forecast relative times now display as `Xh Xm` / `Xd Xh` for durations beyond 60 minutes / 24 hours
- Plot tooltip growth time now shows days/hours (e.g. `2d 6h`) when remaining time exceeds 24 hours

### Changed
- **Fertilizer rebalanced** — speed multipliers are now Basic 1.1×, Advanced 1.25×, Premium 1.5×, Elite 1.75×, Miracle 2×
- **Clear skies more common** — weight increased from 40 → 60

---

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
