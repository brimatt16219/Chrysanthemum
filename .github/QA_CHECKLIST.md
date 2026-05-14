# Manual QA Checklist

Automated checks (lint, typecheck, 281 unit + contract tests, build) run in CI on every push.
This checklist covers behaviour that requires a real browser + live Supabase.

Run this before merging any release branch into `main`.

---

## A. Coins on Harvest

| # | Action | Expected |
|---|--------|----------|
| A1 | Harvest any flower manually (tap a bloomed plot) | Coin balance **does not change** |
| A2 | Harvest a **mutated** bloom (Golden, Frozen, etc.) manually | Coin balance still **does not change** |
| A3 | Sell that mutated bloom from the Inventory tab | Coins **do** increase by `sellValue × multiplier` |
| A4 | DevTools → Network → `harvest` edge function response | Body contains `ok: true`, **no** `bonusCoins`, **no** `coins` field |
| A5 | Supabase Table Editor → `game_saves` → watch `coins` column during a harvest | Column value **does not change** on harvest, only on sell |

---

## B. Harvest Bell — Off-Tab Popup

| # | Action | Expected |
|---|--------|----------|
| B1 | Place a Harvest Bell. Navigate to **Inventory** tab. Wait for a plant to bloom and be in range. | Harvest popup appears **on the Inventory tab** |
| B2 | Same setup, navigate to **Shop** tab | Popup appears on Shop tab |
| B3 | Same setup, navigate to **Social** tab | Popup appears on Social tab |
| B4 | Navigate back to Garden after the popup appeared off-tab | Garden grid correctly shows the plant is gone |
| B5 | Check Inventory tab | Bloom was added to inventory correctly |

---

## C. Harvest Bell — Continues Running Off-Tab

| # | Action | Expected |
|---|--------|----------|
| C1 | Set up a bell + bloomed plant. Navigate away from Garden. Wait 2–3 min. Return. | Bell harvested plants while off-tab; grid is cleared; inventory has blooms |
| C2 | DevTools → Network while on a non-garden tab | `harvest` edge calls fire even when Garden tab is not visible |
| C3 | Watch the **Blooms** badge on the Inventory tab icon | Badge increments when the bell fires off-tab |

---

## D. Auto-Planter — Continues Running Off-Tab

| # | Action | Expected |
|---|--------|----------|
| D1 | Set up an auto-planter with seeds in inventory. Navigate away. Wait 30 s. Return. | Plants were planted while off-tab; seed count in inventory decreased |
| D2 | Trigger a cron race (plant manually while planter is active) | No repeated `plant-seed` calls for already-occupied cells (check DevTools Network) |

---

## E. Profile Page — Real-Time Updates

| # | Action | Expected |
|---|--------|----------|
| E1 | Open your own profile (Social → Me) with a harvest bell and plants | Bell harvests and profile garden updates live every ~5 s without a page reload |
| E2 | From a **second account**, open the first account's profile | Profile updates when the first account's cron ticks (~30 s) |
| E3 | Watch a plant transition seed → sprout → bloom on the other account's profile | Stage advances every ~5 s between cron ticks (client-side simulation) |
| E4 | Bell harvest visible from second account | Profile shows the plot clearing after cron tick |

---

## F. Tab Switching / Mount Stability

| # | Action | Expected |
|---|--------|----------|
| F1 | Rapidly switch between all tabs | No crashes, no white screen, no stuck loading |
| F2 | Plant a seed on Garden tab, switch to Shop, return | Plant is still there with correct growth state |
| F3 | Open Seed Picker on Garden tab, switch tabs | Picker closes; app does not hang |
| F4 | Swipe between tabs while a harvest popup is showing | Popup persists across the swipe and auto-dismisses |

---

## G. Server Integrity (Supabase)

| # | Check | Expected |
|---|--------|----------|
| G1 | `action_log` rows for `harvest` actions | `result` column contains `{ ok: true }`, **no** `bonusCoins` or `newCoins` |
| G2 | `game_saves.coins` across a full session | Only changes on sell/buy, never on harvest |
| G3 | Place gear while a cron tick is in flight | Placement succeeds (CAS retry handles the race); gear appears in grid |

---

## H. Rollback Reliability — Sell All / Plant All (v2.2.5)

Throttle to **Slow 4G** (DevTools → Network → Throttling) for these.

### H1. Sell All — concurrent harvest preserved on failure

| # | Action | Expected |
|---|--------|----------|
| H1.1 | Have several blooms + a bloomed plant in the garden. Click **Sell All** on the Inventory > Blooms tab. While the `shop-action` POST is in flight, harvest the bloomed plant. Then block the `shop-action` URL (DevTools → Network → right-click → Block request URL) so it fails. | Sold blooms restored; coins back to original; **the freshly-harvested bloom remains in inventory** (was the bug). |
| H1.2 | Same as H1.1 but use the per-card **Sell** / **Sell All** buttons in `InventoryItemCard` (single bloom row) instead of the global Sell All. | Same outcome — concurrent harvest preserved. |

### H2. Plant All — failed plant doesn't wipe successful ones

| # | Action | Expected |
|---|--------|----------|
| H2.1 | Open the app in two tabs (same account). Empty plots in both. In tab 1, click **Plant All**. In tab 2, click **Plant All** within ~1 s. Watch tab 1's Network tab. | Some `plant-seed` calls return 200, some return 409 ("Save was modified by another action"). The plots that returned 200 **stay planted** in tab 1; only 409'd plots roll back. (Pre-fix: any single 409 wiped the entire batch.) |
| H2.2 | Same setup but harvest a bloomed plant in tab 1 mid-way through Plant All | Harvest is preserved — Plant All rollbacks don't clobber the new bloom. |

### H3. Plant All flicker — instant visual stays in place

| # | Action | Expected |
|---|--------|----------|
| H3.1 | Empty grid, ≥4 seeds. Throttle Slow 4G. Click **Plant All**. | All seeds appear in their plots **instantly** and stay there. **No flicker** — no plants disappearing then re-planting one at a time as `plant-seed` responses arrive. |
| H3.2 | DevTools Network during H3.1 | `plant-seed` POSTs fire one at a time (serialized). UI does not visibly change as each completes. |

### H4. "Plot already occupied" desync recovery

| # | Action | Expected |
|---|--------|----------|
| H4.1 | Spam Plant All on Slow 4G several times. If you see a 400 "Plot already occupied" in the console for a tile that *looks* empty, try clicking that tile and selecting a seed. | The tile self-heals via `reloadFromCloud` — a brief 400 in console, then the tile updates to show the real server state (either occupied with the actual plant, or genuinely empty and your seed plants). No stuck "can't plant here forever" state. |
| H4.2 | Two-tab repro: in tab 1, plant a seed at (0,0) and wait for confirmation. In tab 2 (without refreshing), click on (0,0) — it still looks empty in tab 2. Pick a seed. | Tab 2 logs one 400 in console, then the tile updates to show tab 1's plant. Subsequent clicks on other tiles in tab 2 work normally. |

### H5. Plant All visual + Collect All interaction (intentional behaviour)

| # | Action | Expected |
|---|--------|----------|
| H5.1 | Click **Collect All** (Harvest All), then immediately click **Plant All** | Plant All visually waits a moment for harvests to settle before planting. **This is intentional** — it prevents a rare flicker if a harvest fails. Don't file as a bug. |

---

## I. v2.3.0 — Shovel, Stage Stability & Fertilizer Guard

### I1. Shovel — required to dig up a growing plant

| # | Action | Expected |
|---|--------|----------|
| I1 | Plant a seed. Open tooltip. Have **no Shovel** in consumables. | "🥄 Need a Shovel to dig up" message shown; no remove button |
| I2 | Craft or buy a Shovel. Open tooltip on a growing plant. Click **🥄 Remove plant** → confirm. | Plot cleared, seed returned to inventory, shovel count decreases by 1 |
| I3 | Place a Garden Pin on a growing plant. Open tooltip with a Shovel present. | "📌 Remove Pin first to dig up" shown; shovel has no effect while pinned |
| I4 | Open tooltip on a **bloomed** plant. | No remove / dig-up section visible at all (harvest section shown instead) |
| I5 | DevTools → Network: block `remove-plant` after clicking confirm. | Plant and shovel both restored to pre-click state (rollback works) |

---

### I2. Stage Stability — no revert when gear multiplier changes

| # | Action | Expected |
|---|--------|----------|
| I6 | Place a 3× Grow Lamp or Mythic Sprinkler next to a plant that is very close to bloom (< 5 s remaining). Watch it cross into bloom stage. Immediately remove the gear. | Stage stays **bloom** — does not revert to sprout or seed |
| I7 | Same as I6 but remove the gear **while the plant is still a sprout** with high multiplier. | Stage stays **sprout** — does not revert to seed |
| I8 | DevTools Console: look for any errors during I6 / I7 | No errors, no warnings about unexpected stage transitions |
| I9 | Place a Balance Scale next to two mid-growth plants. Note the progress bars. Remove the scale. | Progress bars on **both** plants continue smoothly — boosted plant does **not** jump backwards, slowed plant does **not** jump forwards |
| I10 | Same as I9 but wait for the Balance Scale to **expire naturally** rather than removing it manually. | Same result — no progress snap when the gear expires |
| I11 | Place a Balance Scale, remove it, then immediately place a new one in the same cell. | Both actions succeed without 400/409 errors; second placement takes effect and plants respond to new scale |

---

### I3. Fertilizer — cannot be applied to a bloomed plant

| # | Action | Expected |
|---|--------|----------|
| I9 | Open tooltip on a **bloomed** plant with fertilizer in inventory. | No fertilizer section shown (guarded by bloom state) |
| I10 | Open tooltip on a **sprout**, open fertilizer picker, wait for the plant to bloom before clicking. | Fertilizer picker disappears as soon as plant crosses into bloom |
| I11 | DevTools → Network: manually POST to `apply-fertilizer` with a `row`/`col` pointing at a bloomed plant. | Server returns **400** `"Cannot apply fertilizer to a bloomed plant"` |

---

### I4. Mutation Vials — blocked on blooms that already have a mutation

| # | Action | Expected |
|---|--------|----------|
| I12 | Have a **shocked** bloom (or any mutated bloom). Open its tooltip with a Frost Vial in inventory. | Frost Vial (and all other mutation vials) **do not appear** in the consumable picker |
| I13 | Same bloom — have a **Purity Vial** in inventory. | Purity Vial **does** appear and is usable |
| I14 | Apply Purity Vial to clear the mutation. Re-open tooltip with a mutation vial. | Mutation vial now **appears** and can be applied |
| I15 | DevTools → Network: manually POST to `use-consumable` with a mutation vial targeting a bloomed plant that has a mutation. | Server returns **400** `"This bloom already has a mutation — use a Purity Vial to remove it first"` |

---

## J. Sell — v2.3.1 Flowers Award Correct Coins

`shop-action` had missing entries for all v2.3.1 flowers — they were removed from inventory but awarded 0 coins.

| # | Action | Expected |
|---|--------|----------|
| J1 | Sell a **Galebloom** (legendary, 4,000 sell value) from Inventory | Coins increase by **4,000** (or × mutation multiplier); bloom removed |
| J2 | Sell any other v2.3.1 flower (e.g. Infernopetal, Anchorweed, Stormcap) | Coins increase by the correct sell value shown in the inventory card |
| J3 | DevTools → Network → `shop-action` response for a v2.3.1 sell | `coins` field in response equals pre-sell coins + earned amount (not equal to pre-sell coins) |
| J4 | Sell a v2.3.1 flower with a mutation (e.g. Golden Galebloom) | Coins increase by `sellValue × mutationMultiplier`; matches the "X 🟡 total" shown on the card |

---

## K. Weather Mutation Rates (v2.3.1 Balance)

All weather mutation rates reduced by ~1/3. Mutations should still occur but feel rarer.

| # | Action | Expected |
|---|--------|----------|
| K1 | Wait through a full **Rain** event (20 min) with several bloomed plants | Some plants receive Wet mutation; roughly 1-in-4 chance per plant (down from ~1-in-3) |
| K2 | Wait through a full **Heatwave** or **Cold Front** (15 min) | Scorched / Frozen mutations appear occasionally; roughly ~11% per plant |
| K3 | Wait through a **Tornado** (10 min) | Windstruck mutations apply to some bloomed plants; roughly ~23% per plant |
| K4 | Wait through **Golden Hour**, **Prismatic Skies**, or **Star Shower** | Respective mutations appear on ~5% of bloomed plants |
| K5 | Let a plant bloom overnight (10 hr) | Occasional passive Moonlit mutation (~3.5% chance over the night) |
| K6 | DevTools Console: no JS errors or warnings during any weather event | Clean console throughout |

---

## L. Craft Duration Display

`formatDurationLabel` previously rounded 1m 30s → "2 min". Now shows exact minutes + seconds and hours + minutes.

| # | Action | Expected |
|---|--------|----------|
| L1 | Open crafting recipe for any **Uncommon** gear (e.g. Fan I, Composter I) | Duration shows **"1m 30s"** — not "2 min" |
| L2 | Open crafting recipe for any **Rare** gear (e.g. Sprinkler I) | Duration shows **"5 min"** |
| L3 | Open crafting recipe for any **Legendary** gear (e.g. Sprinkler II) | Duration shows **"25 min"** |
| L4 | Open crafting recipe for any **Mythic** gear (e.g. Sprinkler III) | Duration shows **"1 hr"** |
| L5 | Open crafting recipe for any **Exalted** gear (e.g. Sprinkler IV) | Duration shows **"3 hr"** |
| L6 | Open crafting recipe for any **Prismatic** gear (e.g. Sprinkler V) | Duration shows **"6 hr"** |
| L7 | Craft a quantity > 1 (e.g. 3× Fan I) | Duration shows e.g. **"4m 30s"** (3 × 1m 30s); per-item breakdown shows "1m 30s × 3" |

---

## M. Bloom Reveal — Unknown Seeds Show Species at Bloom

Previously, seeds planted before their species was discovered stayed as "???" even at bloom stage.

| # | Action | Expected |
|---|--------|----------|
| M1 | Plant a seed whose species is **not** in your codex. Let it grow to bloom. Open the plot tooltip. | Tooltip shows the **real species name**, emoji, rarity badge, and type badges — not "???" |
| M2 | Same plant — check before bloom (seed or sprout stage) | Tooltip still shows **"???"** and seed/sprout emoji (species only revealed at bloom) |
| M3 | Hover the bloomed plot while it shows the real name. Harvest it. Re-plant the same seed. | During re-grow the species is now in the codex, so it remains identified at all stages |
| M4 | Use a **Magnifying Glass** on an unknown seed/sprout | Still works as before — reveals species before bloom |
| M5 | Open the consumable picker on an unknown bloomed plant | Magnifying Glass **does not appear** (already revealed at bloom; no wasted glass) |

---

## N. Mutation Sell Multipliers

Multipliers synced between client and server. Key values: Golden 4×, Rainbow 5×, Moonlit 2.5×, Shocked 2.5×, Frozen/Scorched/Giant 2×, Wet 1.1×, Windstruck 0.7×.

| # | Action | Expected |
|---|--------|----------|
| N1 | Sell a **Golden** bloom (any species) | Coins increase by `sellValue × 4` |
| N2 | Sell a **Rainbow** bloom | Coins increase by `sellValue × 5` |
| N3 | Sell a **Shocked** bloom | Coins increase by `sellValue × 2.5` |
| N4 | Sell a **Wet** bloom | Coins increase by `sellValue × 1.1` |
| N5 | Sell a **Windstruck** bloom | Coins increase by `sellValue × 0.7` (less than base) |
| N6 | DevTools → Network → `shop-action` response | `coins` field matches pre-sell coins + expected amount for each mutation tier |

---

## O. Weather Time Gating

Golden Hour, Prismatic Skies, and Star Shower are now gated to correct Eastern Time windows (server extracts ET hour directly — no longer uses a hardcoded default).

| # | Action | Expected |
|---|--------|----------|
| O1 | Check weather forecast between **5–7 AM ET** or **5–9 PM ET** | **Golden Hour** may appear in the forecast; Prismatic Skies and Star Shower do not |
| O2 | Check forecast between **7 AM–5 PM ET** | **Prismatic Skies** may appear; Golden Hour and Star Shower do not |
| O3 | Check forecast between **9 PM–5 AM ET** | **Star Shower** may appear; Golden Hour and Prismatic Skies do not |
| O4 | Wait for a Golden Hour event to fire | Occurs only during a dawn, sunset, or dusk period |
| O5 | DevTools Console during any weather advance | No errors; weather type matches the current ET time window |

---

## P. Fan — Wet Strip & Windstruck

Fan now only strips the **Wet** mutation (not all mutations). Windstruck application uses a separate lower rate.

| # | Action | Expected |
|---|--------|----------|
| P1 | Place a Fan next to a **Wet** bloomed plant | Wet mutation is stripped over time (50–80%/hr depending on tier); plant becomes unmutated |
| P2 | Place a Fan next to a **Scorched** (or any non-Wet, non-Windstruck) bloomed plant | Fan does **nothing** — mutation stays |
| P3 | Place a Fan next to an **unmutated** bloomed plant | Windstruck may appear at a low rate (~15%/hr); much rarer than Wet stripping |
| P4 | Place a Fan next to a **Windstruck** plant | Fan does nothing — already Windstruck |
| P5 | Navigate away. Return after 10+ minutes with a Fan active on a Wet plant | Wet was stripped during offline tick (server processed it) |

---

## Q. Sprinklers & Mutation Sprinklers — Offline

Sprinklers now run during offline cron ticks. Scarecrow blocks all gear mutations; Aegis blocks weather only.

| # | Action | Expected |
|---|--------|----------|
| Q1 | Place a **regular Sprinkler** next to unmutated blooms. Navigate away for 30+ min. Return. | Some blooms have the **Wet** mutation |
| Q2 | Place a **Heater** (Scorched) or **Cooler** (Frozen) next to unmutated blooms. Navigate away. Return. | Some blooms carry the sprinkler's mutation |
| Q3 | Place a **Generator** (Shocked) next to Wet blooms. Navigate away. Return. | Some Wet blooms upgraded to **Shocked** |
| Q4 | Place a **Scarecrow** between an active mutation sprinkler and its target blooms. Navigate away. Return. | Blooms covered by the Scarecrow have **no new mutations** from the sprinkler |
| Q5 | Place an **Aegis** between a mutation sprinkler and target blooms. Navigate away. Return. | Blooms covered by the Aegis **still receive** the sprinkler mutation (Aegis only blocks weather) |
| Q6 | Place a **Scarecrow** during a Rain event. Navigate away. Return. | Blooms covered by the Scarecrow have **no Wet mutation** from rain |
| Q7 | Place an **Aegis** during a Rain event. Navigate away. Return. | Blooms covered by the Aegis have **no Wet mutation** from rain (Aegis blocks weather) |

---

## R. Marketplace — Expired Listing Mail-Back

Expired listings are now delivered via the mailbox instead of silently patching `game_saves` inventory.

| # | Action | Expected |
|---|--------|----------|
| R1 | Let a marketplace listing expire (or trigger the cron manually via GitHub Actions → workflow_dispatch) | Seller receives a "Listing Expired" mail with the correct item kind, species, mutation, and is_seed |
| R2 | Open the expired-listing mail and press Claim | Item is added to the seller's inventory (flower/seed/gear/fertilizer/consumable as appropriate) |
| R3 | Verify a fertilizer listing expires | Mail kind is `fertilizer`; claiming it increments the correct fertilizer type |
| R4 | Verify a gear listing expires | Mail kind is `gear`; claiming it adds the gear to gear_inventory |

---

## S. v2.3.2 — Harvest v2.3.1 Flowers (#175)

`FLOWER_GROWTH_TIMES` in the harvest edge function was missing all 38 v2.3.1 species, causing a 400 "Unknown species" error.

| # | Action | Expected |
|---|--------|----------|
| S1 | Harvest any v2.3.1 flower (e.g. **Galebloom**, **Infernopetal**, **Cloudveil**) manually or via bell | Harvest succeeds; bloom added to inventory; **no** "Unknown species" 400 in console |
| S2 | Harvest a mutated v2.3.1 flower (e.g. Golden Galebloom) | Harvest succeeds with the correct mutation applied to the inventory bloom |
| S3 | DevTools → Network → `harvest` response for a v2.3.1 flower | Response is `{ ok: true }` — no error body |

---

## T. v2.3.2 — Composter Offline Tick (#158)

Composter logic was previously client-side only. It now also runs in `tick-offline-gardens`.

| # | Action | Expected |
|---|--------|----------|
| T1 | Place a Composter next to several seeds. Navigate away for 30+ min. Return. | Some of the plots that bloomed while away have fertilizer applied (check plot tooltips) |
| T2 | Place a Composter I (Uncommon, 3×3 range) next to a bloom that blooms offline. Return. | Fertilizer roll occurred; rarity matches Uncommon tier (Common/Uncommon fertilizers) |
| T3 | Place a Composter III (Legendary, Diamond range) offline. | Range covers expected diamond-shaped cells; fertilizer is applied within range |
| T4 | Place a Composter with its `maxStorage` already full (10 charges). Navigate away. | No additional fertilizer piles up beyond the storage cap after plants bloom offline |

---

## U. v2.3.2 — Plot Tooltip Consumable Filter (#177 / #173)

Speed boosts (Forge Haste) and seed pouches should never appear in the per-plot consumable picker.

| # | Action | Expected |
|---|--------|----------|
| U1 | Open a plot tooltip (growing or bloomed plant). Have **Forge Haste** consumables in inventory. | Forge Haste does **not** appear in the consumable list |
| U2 | Same tooltip with any **Seed Pouch** in inventory. | Seed Pouch does **not** appear |
| U3 | Open the tooltip with Frost Vials, Fertilizer, etc. in inventory. | Those consumables **do** appear (filter only removes speed boosts and seed pouches) |
| U4 | Tooltip with many consumables (10+) visible. | Tooltip scrolls vertically; bottom items are accessible; tooltip does not extend off-screen |

---

## V. v2.3.2 — Shop Restock Flicker (#172)

A stale server response was clobbering the client's freshly-restocked shop list, causing a visible flicker back to the old items.

| # | Action | Expected |
|---|--------|----------|
| V1 | Wait for the seed shop to restock (or use the dev panel to force a restock). | Shop updates to new items **without** briefly showing the old shop list |
| V2 | Wait for the supply shop to restock. | Supply shop updates cleanly — **no flicker** back to the pre-restock gear/consumable list |
| V3 | Throttle to Slow 4G. Trigger a shop restock. Watch DevTools Network. | Even with slow responses arriving after the client reset, the new shop list holds |

---

## W. v2.3.2 — Balance Scale Rework (#181)

Range is now fixed at 1 cell each side for all tiers. Boost/slow values increased per tier: Scale I 4×/0.5×, Scale II 6×/0.33×, Scale III 8×/0.25×.

| # | Action | Expected |
|---|--------|----------|
| W1 | Place a **Balance Scale I** with one plant to its left and one to its right. Watch growth rates. | Boosted side grows **4×** faster than base; slowed side grows at **0.5×** base speed |
| W2 | Wait for the hour to flip (or use dev panel to advance time). | The boost and slow **swap sides** |
| W3 | Place a **Balance Scale II** and compare growth rates to Scale I. | Boosted side visibly faster (**6×**); slowed side more penalized (**0.33×**) than Scale I |
| W4 | Place a **Balance Scale III** and compare. | Boosted side at **8×**; slowed side at **0.25×** |
| W5 | Check gear tooltip descriptions for all three tiers. | Each description shows the correct boost and slow values for that tier |

---

## X. v2.3.3 — Heirloom Charm Fixes

Seed now returned to inventory on harvest; duplicate bloom row fixed; seed toast fires; tooltip hides charm if already applied.

| # | Action | Expected |
|---|--------|----------|
| X1 | Apply a Heirloom Charm to a growing plant, wait for it to bloom, then harvest it. Check inventory. | Inventory gains **both** a bloom entry **and** a seed entry for that species in one harvest |
| X2 | Harvest the same species again without a charm. | Only one bloom row exists — no duplicate row created |
| X3 | Harvest a plant with Heirloom Charm active. Watch for toast notifications. | Two toasts appear: one for the bloom (with rarity colour) and a separate **green "+1 Seed"** toast |
| X4 | Open the plot tooltip on a plant that already has a Heirloom Charm applied. | **Heirloom Charm is not listed** in the consumable picker — it is hidden once `heirloomActive` is set |
| X5 | Check the Heirloom Charm I recipe in the Craft tab. | Recipe requires **8× Fairy + 4× Stellar + 4× Arcane Essence** (see AG1 for v2.3.6 update) |

---

## Y. v2.3.3 — Inventory Search Bar & Header Counts

| # | Action | Expected |
|---|--------|----------|
| Y1 | Open Inventory → Seeds tab. Type part of a flower name in the search bar. | List filters to matching seeds only; non-matching seeds are hidden |
| Y2 | Clear the search. Switch to Blooms tab. Search for a species. | Blooms tab has its own independent search; results filter correctly |
| Y3 | Search for a term with no matches on any tab. | Shows an empty state (no crash, no stale results) |
| Y4 | Open Inventory with consumables and essences in your inventory. Check the header line. | Header reads something like **"124 seeds · 46 blooms · 145 supplies · 3 consumables · 12 essences"** |

---

## Z. v2.3.3 — Codex Badge Cross-Device Sync

| # | Action | Expected |
|---|--------|----------|
| Z1 | Discover a new species on Device A. Open the Codex and expand that species card. | Badge clears on Device A |
| Z2 | Open the same account on Device B (fresh load or tab refresh). | **No badge** for the already-acknowledged species — badge does not reappear |
| Z3 | Sign in on a brand-new device that has never loaded this account. | No flood of "newly discovered" badges for previously known species — all existing discoveries are pre-acknowledged |
| Z4 | Discover a new species (don't open the card yet). Open the app on another device. | The **new** species still shows a badge on both devices until the card is opened |

---

## AA. v2.3.4 — Lawnmower, Aqueduct & Balance Scale Crafting

Server-side recipe tables in `craft-start` and `craft-cancel` were missing all three gear families — attempts to craft them returned a 400 error.

| # | Action | Expected |
|---|--------|----------|
| AA1 | Open Craft tab → Gear. Start a **Lawnmower I** craft (requires Grove + Solar essence). | Craft queues successfully and completes after the timer |
| AA2 | Upgrade Lawnmower I → II → III via the craft queue. | Each upgrade tier accepts the previous tier as ingredient and produces the next |
| AA3 | Start an **Aqueduct I** craft (requires Tide + Zephyr essence). | Craft queues and completes correctly |
| AA4 | Start a **Balance Scale I** craft (requires Arcane + Solar + Shadow essence). | Craft queues and completes correctly |
| AA5 | Cancel an in-progress Lawnmower, Aqueduct, or Balance Scale craft. | Ingredients are refunded correctly |

---

## AB. v2.3.4 — Gear Expiry Toast Stacks With Other Notifications (#191)

Gear expiry banner was rendered outside the shared notification stack, causing it to overlap shop restock and craft completion banners.

| # | Action | Expected |
|---|--------|----------|
| AB1 | Let a piece of gear expire while the seed shop restocks at the same time. | Both the gear expiry banner and shop restock banner appear **stacked vertically** — no overlap |
| AB2 | Let gear expire while a craft completes. | Gear expiry and craft completion banners stack cleanly in the shared container |
| AB3 | Trigger gear expiry on its own (no other notifications). | Gear expiry banner appears at the bottom centre, same position as other banners |

---

## AC. v2.3.5 — Toast Notifications

Loss/gain pill toasts now fire for seeds, blooms, gear, consumables, fertilizer, and crafting costs.

| # | Action | Expected |
|---|--------|----------|
| AC1 | Plant a seed manually (tap plot → pick seed) | A **red "-1 [Seed Name] Seed"** toast appears at the bottom of the screen |
| AC2 | Plant a seed whose species is undiscovered | Toast shows **"-1 ❓ ??? Seed"** in red |
| AC3 | Click **Plant All** with several seeds in inventory | One red loss toast per species — toasts stack and accumulate count (e.g. "-3 🌸 Rose Seed") |
| AC4 | Harvest a bloomed plant | A loss toast fires for the bloom (with rarity colour); **no** extra gain toast |
| AC5 | Place a piece of gear on a plot | A red loss toast shows the gear emoji, name, and rarity colour |
| AC6 | Use a Shovel to dig up a growing plant | A red **"-1 🥄 Shovel"** toast appears |
| AC7 | Apply a consumable from the plot tooltip (e.g. Frost Vial) | A red loss toast for that consumable appears |
| AC8 | Buy a seed from the Shop | A **green "+1 [Seed Name] Seed"** toast appears |
| AC9 | Click **Buy All** for a seed in the Shop | Toast shows the total quantity purchased (e.g. "+5 🌸 Rose Seed") |
| AC10 | Buy an item from the Supply Shop (fertilizer, gear, or consumable) | A green gain toast appears with the correct emoji and label |
| AC11 | Craft a gear item in the Craft tab | Red loss toasts fire for each essence spent; a gain toast fires for the crafted item |
| AC12 | Multiple rapid actions of the same type (e.g. Plant All 3 of the same seed) | Toasts **accumulate** into a single pill with the combined count rather than spawning duplicates |

---

## AD. v2.3.5 — Balance: Vials & Heirloom Charms Rarity Nerf

Vials and Heirloom Charms now require the plant's rarity to be **strictly below** the consumable's tier (same-rarity no longer allowed).

| # | Action | Expected |
|---|--------|----------|
| AD1 | Open a plot tooltip on a **Rare** plant with a **Rare (Tier I)** Frost Vial in inventory | Frost Vial **does not appear** in the consumable list |
| AD2 | Same Rare plant with a **Legendary (Tier II)** Frost Vial | Frost Vial **does** appear and can be applied |
| AD3 | Open a tooltip on a **Rare** bloom with a **Rare (Tier I)** Heirloom Charm | Heirloom Charm **does not appear** |
| AD4 | Same bloom with a **Legendary (Tier II)** Heirloom Charm | Heirloom Charm **does** appear and can be applied |
| AD5 | Check the description of any Tier I vial (e.g. Frost Vial I) in the Craft tab | Description reads **"Uncommon or lower"** (not "Rare or lower") |
| AD6 | DevTools → Network: POST to `use-consumable` with a Tier I Rare vial targeting a Rare plant | Server returns **400** with "can't reach" error |

---

## AE. v2.3.5 — Balance: Seed Pouch Upgrade Cost

Upgrading any Seed Pouch (base or typed) now costs **4×** of the previous tier instead of 3×.

| # | Action | Expected |
|---|--------|----------|
| AE1 | Open Craft tab → Consumables → **Seed Pouch II** recipe | Cost shows **4× Seed Pouch I** (not 3×) |
| AE2 | Attempt to craft Seed Pouch II with only 3× Seed Pouch I in inventory | Craft button is **disabled** / server rejects the attempt |
| AE3 | Check any **typed** Seed Pouch upgrade (e.g. Blaze Seed Pouch II) | Cost is also **4×** of the previous tier |

---

## AF. v2.3.6 — Eclipse Tonic Fixes

Eclipse Tonic now shifts all farm timestamps (plants + gear), applies immediately without a refresh, retries on save conflicts, and is excluded from plot tooltips.

| # | Action | Expected |
|---|--------|----------|
| AF1 | Have an Eclipse Tonic in inventory. Open the plot tooltip on any growing or bloomed plant. | Eclipse Tonic **does not appear** in the consumable picker |
| AF2 | Use an Eclipse Tonic from the Inventory panel. Watch the garden immediately after. | Growth bars and gear timers **update instantly** — no page refresh required |
| AF3 | Use an Eclipse Tonic while a harvest is in progress (rapid back-to-back actions). | Tonic applies successfully — it does not silently fail or roll back |
| AF4 | Place a Sprinkler or other gear on a plot. Use an Eclipse Tonic. | Gear's remaining duration **decreases** by the tonic's advance amount (gear is affected) |
| AF5 | Place a gear with crossbreed progress (Balance Scale). Use an Eclipse Tonic. | Crossbreed phase advances in step with the tonic's shift |
| AF6 | Have a bloom-placed plant (sentinel `timePlanted = 0`). Use an Eclipse Tonic. | Bloom-placed plant is **not corrupted** — it remains in its bloomed state |
| AF7 | Dev panel (Items tab → Shop section) → click **Reset Eclipse Cooldown**. | Toast confirms cooldown reset; Eclipse Tonic is immediately usable again |

---

## AG. v2.3.6 — Balance: Tier I Consumable Recipe Costs

Heirloom Charm I, Moon Vial I, Rainbow Vial I, and Gold Vial I have updated essence costs.

| # | Action | Expected |
|---|--------|----------|
| AG1 | Open Craft tab → Consumables → **Heirloom Charm I** recipe | Cost shows **8× Fairy + 4× Stellar + 4× Arcane Essence** |
| AG2 | Open Craft tab → Consumables → **Moon Vial I** recipe | Cost shows **8× Lunar + 4× Arcane Essence** |
| AG3 | Open Craft tab → Consumables → **Rainbow Vial I** recipe | Cost shows **2× Universal Essence** |
| AG4 | Open Craft tab → Consumables → **Gold Vial I** recipe | Cost shows **8× Solar + 8× Stellar Essence** |
| AG5 | Attempt to craft Heirloom Charm I without the required essences | Craft button is **disabled**; server rejects the attempt with 400 |

---

## AH. v2.3.7 — Harvest All Bloom Fix

Blooms on plots that were missing a `plant_timings` row (e.g. planted via Plant All) were silently discarded — the plot cleared but no bloom was added to inventory.

| # | Action | Expected |
|---|--------|----------|
| AH1 | Fill the entire farm using **Plant All**, wait for all plants to bloom, then click **Harvest All** | Inventory gains **one bloom per plot** — no blooms are silently dropped |
| AH2 | Repeat with a mix of manually planted and Plant All planted flowers | All blooms appear in inventory regardless of how the seed was planted |
| AH3 | Check inventory count before and after Harvest All on a full farm | Count increases by exactly the number of bloomed plots |

---

## AI. v2.3.7 — Codex "New" Filter

A **New** filter tab has been added to the Codex status bar showing only newly discovered species. The tab has a red dot indicator and disables itself when there is nothing new.

| # | Action | Expected |
|---|--------|----------|
| AI1 | Discover a new flower for the first time. Open the Codex. | A red dot appears above the **✦ New** filter tab |
| AI2 | Click the **✦ New** tab | Only newly discovered species are shown |
| AI3 | Expand every card shown in the **✦ New** tab | Red dot disappears and the tab **auto-resets to All** once the last entry is acknowledged |
| AI4 | Open Codex with no new discoveries | **✦ New** tab is greyed out and non-clickable |
| AI5 | Acknowledge all new entries, navigate away, return to Codex | **✦ New** tab is still disabled — no stale dot |

---

## AJ. Bug #222 — Gear Removal Progress Bar Continuity

Growth multiplier changes (gear removed or expired) previously caused the progress bar to snap: boosted plants jumped backwards, slowed plants jumped forwards. Fixed by time-weighting the gear multiplier across the checkpoint delta.

| # | Action | Expected |
|---|--------|----------|
| AJ1 | Place a **Balance Scale I** next to two plants (~30–50% grown). Let them grow for ~10 s. Remove the scale. | Progress bars on both plants continue from where they were — no backward/forward snap on removal |
| AJ2 | Repeat AJ1 with a **Sprinkler** (any tier) covering a plant. Remove it mid-growth. | Progress bar continues smoothly — no regression |
| AJ3 | Place a short-duration sprinkler next to a plant. Let it **expire naturally**. | Progress bar does not snap at the moment of expiry |
| AJ4 | Remove a Balance Scale, then immediately place a new one in the same cell. | Second `gear-action` place succeeds — no `400 "Cell already has gear"` or `409` cascade in DevTools Network |
| AJ5 | DevTools Network: inspect the `gear-action` remove call after AJ1. | Returns **200 OK**; if a CAS retry was needed the response JSON contains `retried: true` in the action log (check Supabase `action_log` table) |

---

## AK. v2.4.0 — Title Screen & Enter Garden Flow

| # | Action | Expected |
|---|--------|----------|
| AK1 | Open the app while signed in | Lands on the **login page** — garden does not load yet; no music plays |
| AK2 | On the login page, click **Enter Garden** | Garden loads; background music starts; level-up SFX is suppressed on the initial level jump |
| AK3 | Reload the page while signed in | Returns to login page again, not directly into the garden |
| AK4 | On the login page, click **Sign Out** | Signs out and shows the login page with Google sign-in option |
| AK5 | In settings (while in the garden), tap **Go to title screen** | Returns to login page without signing out; can re-enter garden immediately |
| AK6 | DevTools → Console during AK1 | No audio errors; no music or SFX fires before Enter Garden is clicked |

---

## AL. v2.4.0 — Google Sign-In Popup

| # | Action | Expected |
|---|--------|----------|
| AL1 | On the login page, click **Sign in with Google** | A **popup window** opens for Google OAuth — the main page does not redirect |
| AL2 | Complete sign-in in the popup | Popup closes; main window **reloads and signs in** without any manual interaction |
| AL3 | Close the popup without completing sign-in | Main window remains on the login page; no error shown |
| AL4 | DevTools Network on the main window during popup auth | No navigation event on the main page until the popup closes and reloads it |

---

## AM. v2.4.0 — Audio System

| # | Action | Expected |
|---|--------|----------|
| AM1 | Click Enter Garden during daytime | **Daytime ambient music** starts playing |
| AM2 | Wait for the time period to shift to night | Music cross-fades to the **nighttime track** without a hard cut |
| AM3 | During a **Rain** weather event | Weather ambience layer (rain sound) fades in over the ambient music |
| AM4 | Plant a seed | A short **plant SFX** fires at the moment of tap, not after the server round-trip |
| AM5 | Harvest a bloomed plant | **Harvest SFX** fires immediately |
| AM6 | Sell a bloom from inventory | **Sell SFX** fires; sell toast shows the correct coin amount |
| AM7 | Buy a seed from the shop | **Buy SFX** and flashBought animation fire at interaction time |
| AM8 | Level up | **Level-up SFX** plays |
| AM9 | Mute music in settings | Music stops; SFX still plays |
| AM10 | Mute SFX in settings | SFX silent; music continues |
| AM11 | Set music volume to 0% | No music audible; slider can raise volume again |
| AM12 | Navigate back to login page and re-enter garden | Music restarts cleanly; no doubled-up audio tracks |

---

## AN. v2.4.0 — Pixel Art Sprites

| # | Action | Expected |
|---|--------|----------|
| AN1 | Open the garden with sprites enabled (default) | All plot tiles, gear, and HUD icons show pixel art sprites instead of emoji |
| AN2 | Open Inventory → Blooms | Each bloom row shows the correct pixel art sprite for that species and rarity |
| AN3 | Open the Shop | Seed listings show flower sprites; gear/consumable listings in Supply Shop show item sprites |
| AN4 | Open Codex | Species entries show bloom sprites; mutation entries show mutation VFX alongside sprites |
| AN5 | Disable sprites in settings → Toggle **Use Sprites** off | UI falls back to emoji rendering everywhere |
| AN6 | Re-enable sprites | Sprites return immediately without a page reload |
| AN7 | Open a Marketplace listing for a mutated bloom | Listing card shows the mutation VFX sheen animation on the sprite |
| AN8 | Check the leaderboard top 3 | Gold, silver, bronze medal sprites shown next to rank numbers |

---

## AO. v2.4.0 — Mutation VFX

| # | Action | Expected |
|---|--------|----------|
| AO1 | Have a **Shocked** bloom in garden. Open plot tooltip. | Plot tile shows a blue-tinted sheen VFX; tooltip shows the VFX on the bloom sprite |
| AO2 | Check the same bloom in Inventory | Bloom row displays the mutation VFX (colorized sheen animation) |
| AO3 | List the bloom on the Marketplace | Listing card shows the VFX on the bloom |
| AO4 | Disable mutation VFX in settings | Mutation sheen disappears; plain badge shown instead (or nothing if badge is also off) |
| AO5 | Check profile — view your own garden | Mutated blooms show VFX on plot tiles in the read-only garden |

---

## AP. v2.4.0 — Gardener XP & Leveling

| # | Action | Expected |
|---|--------|----------|
| AP1 | Harvest a bloom | XP bar in HUD increases; if level threshold crossed, level-up SFX plays |
| AP2 | Sell a bloom | XP awarded; HUD bar updates |
| AP3 | Buy a seed from the shop | XP awarded |
| AP4 | Open a Seed Pouch | XP awarded |
| AP5 | Complete a craft in the crafting queue | XP awarded on collect |
| AP6 | Sell a bloom on the marketplace (as seller) | XP awarded when buyer purchases |
| AP7 | Reload the page | XP bar shows the correct persisted level and XP — no regression to 0 |
| AP8 | Try to unlock a marketplace listing slot at too low a level | Button disabled or shows a "Requires Gardener Level X" message |
| AP9 | Try to purchase a farm upgrade at too low a level | Same gate applies |

---

## AQ. v2.4.0 — Achievements

| # | Action | Expected |
|---|--------|----------|
| AQ1 | Open Events tab → Achievements sub-tab | Achievement categories shown as a grid; progress bars reflect current stats |
| AQ2 | Harvest enough blooms to cross a milestone (e.g. 10 harvests) | Achievement shows as claimable; badge on the Achievements panel |
| AQ3 | Claim an achievement | Gems awarded; achievement marked claimed; cannot be claimed again |
| AQ4 | Reload the page | Claimed achievements persist; stats still accurate |
| AQ5 | Check "Flower Discovery" category | Tiers reflect how many unique species have been discovered (not harvest count) |
| AQ6 | DevTools → Network after claiming | `achievement-claim` edge function returns `{ ok: true, gems: N }` |

---

## AR. v2.4.0 — Gems

| # | Action | Expected |
|---|--------|----------|
| AR1 | Claim an achievement | Gem balance in HUD increases by the reward amount |
| AR2 | Complete all daily tasks | Gem reward added to balance |
| AR3 | Reload the page | Gem balance persists correctly |
| AR4 | Check the HUD | Gem count displayed alongside coin count |

---

## AS. v2.4.0 — Daily Tasks

| # | Action | Expected |
|---|--------|----------|
| AS1 | Open Events tab → Daily Tasks | Today's tasks shown with progress bars |
| AS2 | Harvest a bloom | Harvest task progress increments immediately |
| AS3 | Sell a bloom | Sell task progress increments |
| AS4 | Plant a seed | Plant task progress increments |
| AS5 | Complete all daily tasks | Claim button appears; tapping it awards coins and gems |
| AS6 | After claiming, reload the page | Tasks remain marked as claimed for the day |
| AS7 | Next calendar day | Tasks reset with new objectives |

---

## AT. v2.4.0 — Sakura Blossom Event

| # | Action | Expected |
|---|--------|----------|
| AT1 | Open Events tab | Sakura Blossom Event card visible with **May 10 – May 31** date range |
| AT2 | Check in on the event | Check-in progress increments; rewards shown |
| AT3 | Check the seed shop during the event | **Sakura Blossom** seed may appear as an exclusive listing |
| AT4 | Harvest a Sakura Blossom bloom | Bloom added to inventory correctly; codex entry created |
| AT5 | DevTools → Network on check-in | `event-checkin-claim` returns `{ ok: true }` |
| AT6 | Check event card after the event window ends (post May 31) | Event card shows as ended; check-in button disabled |

---

## AU. v2.4.0 — Notification Consolidation & Clear All

| # | Action | Expected |
|---|--------|----------|
| AU1 | Harvest the same species 3 times rapidly | A single toast accumulates to **+3** rather than three separate toasts |
| AU2 | Trigger several different notifications at once (harvest, craft complete, shop restock) | Toasts stack vertically without overlapping |
| AU3 | With multiple toasts on screen, tap **Clear All** | All toasts dismiss immediately |
| AU4 | Single notification without Clear All | Notification auto-dismisses after its normal duration; no looping |

---

## AV. v2.4.0 — SeedPicker Rarity Filter & Sort (#263)

| # | Action | Expected |
|---|--------|----------|
| AV1 | Tap an empty plot to open the seed picker | Rarity filter chips and sort control visible at the top |
| AV2 | Select "Rare" filter | Only Rare seeds shown in the list |
| AV3 | Select multiple rarities | All selected rarities shown; others hidden |
| AV4 | Change sort to "Rarity ↑" | Seeds sorted from common to rare |
| AV5 | Clear filters | All seeds restored |

---

## AW. v2.4.0 — Bulk Plant/Harvest Filter Modal (#262)

| # | Action | Expected |
|---|--------|----------|
| AW1 | Long-press or tap the **Plant All** button | Filter modal opens with rarity and type multi-select |
| AW2 | Select "Legendary" rarity only and confirm | Only Legendary seeds are planted; others left in inventory |
| AW3 | Open **Collect All** filter | Filter modal opens; select a subset of rarities |
| AW4 | Confirm Collect All filter | Only blooms matching the selected rarity/type are harvested |
| AW5 | Clear filters and Plant/Collect All | All eligible plants/blooms are affected (normal behaviour) |

---

## AX. v2.4.0 — Per-Rarity Select-All on Sacrifice Screen (#251)

| # | Action | Expected |
|---|--------|----------|
| AX1 | Open AlchemyTab → Sacrifice view | Each rarity section has **Select All** and **Clear** buttons |
| AX2 | Tap **Select All** on the Rare row | All Rare blooms in inventory selected |
| AX3 | Tap **Clear** on the Rare row | Rare selection cleared; other rarity selections unaffected |
| AX4 | Mix of manual and select-all selections | Only selected blooms show in the sacrifice summary |

---

## AY. v2.4.0 — Seed Shop Slot Lock (#238)

| # | Action | Expected |
|---|--------|----------|
| AY1 | In the seed shop, tap the lock icon on a listing slot | Slot shows a locked indicator; lock persists after restock |
| AY2 | Wait for a shop restock | Locked slot retains its current seed; other slots refresh normally |
| AY3 | Tap the lock again to unlock | Slot unlocks; next restock replaces it normally |
| AY4 | Reload the page | Lock state persists |

---

## AZ. v2.4.0 — Auto-Planter Pause/Resume (#245)

| # | Action | Expected |
|---|--------|----------|
| AZ1 | Place an Auto-Planter with seeds in inventory | Planter begins planting empty cells |
| AZ2 | Open the Auto-Planter's gear tooltip and tap **Pause** | Planter stops planting; plots remain empty |
| AZ3 | Tap **Resume** | Planting resumes |
| AZ4 | Navigate away while paused | Planter stays paused; no plants appear |
| AZ5 | Navigate away while running | Planter continues planting off-tab (existing offline behaviour) |

---

## BA. v2.4.0 — Balance Scale Flip Countdown (#239/#240)

| # | Action | Expected |
|---|--------|----------|
| BA1 | Place a Balance Scale. Open its gear tooltip. | Tooltip shows current phase (Boost or Slow) **and a countdown** to the next flip |
| BA2 | Wait for the phase to flip | Countdown resets; phase label changes |
| BA3 | Compare tooltip countdown to actual flip time | Countdown matches the observed flip time (± a few seconds for render lag) |

---

## BB. v2.4.0 — Weather Effects Toggle

| # | Action | Expected |
|---|--------|----------|
| BB1 | Open settings → disable **Weather Effects** | Rain particles, lightning flash, snow overlay, and other weather animations are **not rendered** |
| BB2 | Weather still advances and affects mutations | Mutations still apply during rain/storm even with effects disabled |
| BB3 | Re-enable Weather Effects | Overlays return immediately without a reload |

---

## BC. v2.4.0 — Ghost Gear After Expiry (#242)

| # | Action | Expected |
|---|--------|----------|
| BC1 | Let any piece of gear reach 0 time remaining | Gear disappears from the plot tile; plot is empty and re-interactable |
| BC2 | DevTools → Network: watch the client tick during expiry | No additional `gear-action` remove call needed — gear removed client-side on expiry |
| BC3 | Reload the page after gear expires | Expired gear **not present** in the loaded state — not reloaded from DB |
| BC4 | Check Supabase `game_saves.grid` after expiry and a cloud save | Gear entry is absent from the saved grid |

---

## BD. v2.4.0 — Shop Restock Blink Race (#243)

| # | Action | Expected |
|---|--------|----------|
| BD1 | Wait for the seed shop to restock | Shop updates to new items with **no blank flash** |
| BD2 | Throttle to Slow 4G in DevTools. Trigger a restock. | Even with delayed responses, new listings appear without reverting to the old list |

---

## BE. v2.4.0 — Heirloom Charm Duplication Exploit

| # | Action | Expected |
|---|--------|----------|
| BE1 | Apply a Heirloom Charm to a plant. Use an Eclipse Tonic to skip time. Harvest the plant. | Only **one seed** returned; no duplicate bloom row in inventory |
| BE2 | Attempt to apply a second Heirloom Charm to the same plant (via DevTools POST) | Server returns **400** rejecting the duplicate activation |

---

## Automated Gates (CI — must pass before merge)

```
npm run typecheck
npm run lint
npm run test:ci
npm run build
```
