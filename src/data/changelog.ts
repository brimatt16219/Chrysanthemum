export type ChangelogItemType = "added" | "fixed" | "changed";

export interface ChangelogItem {
  type: ChangelogItemType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  title: string;
  items: ChangelogItem[];
}

// Most recent version first — update this with every release
export const CHANGELOGS: ChangelogEntry[] = [
  {
    version: "2.0.0",
    title:   "Server-Authoritative Architecture",
    items: [
      { type: "added",   text: "🔒 All game actions (plant, harvest, buy, sell, fertilize, upgrade, convert) are now validated server-side via Edge Functions — no client can fake progress" },
      { type: "added",   text: "Optimistic UI with automatic rollback — actions feel instant but revert if the server rejects them" },
      { type: "changed", text: "Game saves are now protected by Row Level Security — all writes go through the server" },
      { type: "changed", text: "Coin calculations, inventory changes, and codex discoveries are all validated server-side" },
    ],
  },
  {
    version: "1.6.0",
    title:   "Economy & Prismatic Update",
    items: [
      { type: "added",   text: "🌈 Prismatic rarity — a new tier above Exalted with animated rainbow borders, glow, and color; obtainable only through Botany" },
      { type: "added",   text: "20 new flowers — 3 Uncommon, 5 Rare, 4 Legendary, 1 Mythic, and 6 Prismatic including the special Princess Blossom" },
      { type: "added",   text: "⚡ Codex Mastery — fully discover a flower (base bloom + all 9 mutations) to permanently grow that species 20% faster" },
      { type: "added",   text: "Mastery indicators — ⚡ badge in the seed picker and yellow highlighted timer in the plot tooltip show when a mastery bonus is active" },
      { type: "changed", text: "Shop now rolls rarity first (weighted: Common → Mythic), then picks a random flower from that tier — guaranteeing variety across all rarities" },
      { type: "changed", text: "Shop buy price changed from 60% → 75% of sell value" },
      { type: "changed", text: "Sell values rebalanced across all tiers — each tier now has at most a 2× spread from cheapest to most expensive, scaled by growth time" },
      { type: "fixed",   text: "Coral Bells renamed to Pearlwort with a working emoji (previous emoji was broken on older devices)" },
    ],
  },
  {
    version: "1.5.2",
    title:   "Bug Fixes",
    items: [
      { type: "fixed", text: "Leaderboard filter buttons (Global, Friends, Coins, Codex) are now a single equal-width row on mobile" },
    ],
  },
  {
    version: "1.5.1",
    title:   "Quick Fix",
    items: [
      { type: "fixed", text: "Changelog modal is now scrollable on mobile so the dismiss button is always reachable" },
    ],
  },
  {
    version: "1.5.0",
    title:   "Weather & Mutations Update",
    items: [
      { type: "added",   text: "Weather Forecast — unlock up to 8 slots to preview upcoming weather events with estimated start times" },
      { type: "added",   text: "⛈️ Thunderstorm — 2× growth speed; unmutated plants can become Wet or Shocked, Wet plants can upgrade to Shocked over the storm" },
      { type: "added",   text: "🌪️ Tornado — instantly applies a random mutation to every bloomed flower in your garden" },
      { type: "added",   text: "⚡ Shocked mutation — applied by thunderstorm, upgraded from Wet during a storm" },
      { type: "added",   text: "💨 Windstruck mutation — applied instantly by tornado" },
      { type: "added",   text: "Day/night ambient tint — screen shifts through dawn, morning, midday, afternoon, sunset, dusk, night, and midnight" },
      { type: "added",   text: "Display flower mutation badge — your active mutation shows as a small icon on your profile flower in the HUD" },
      { type: "fixed",   text: "Rarity borders and backgrounds now correctly display on other players' profile gardens" },
      { type: "fixed",   text: "Fertilizers in plot tooltip are now sorted by effectiveness (weakest → strongest)" },
      { type: "fixed",   text: "Social tab buttons are equal-width and emoji-only on mobile" },
      { type: "fixed",   text: "Social tab no longer deselects in the navbar when viewing a profile" },
      { type: "fixed",   text: "Weather forecast no longer shows '0m 0s' during clear skies" },
      { type: "changed", text: "Profile page is now embedded inside the Social tab — the 5-button nav stays visible at all times" },
      { type: "changed", text: "Wet → Shocked upgrade now applies gradually (~50% chance over the storm duration) instead of instantly" },
    ],
  },
  {
    version: "1.4.0",
    title:   "Mutations Update",
    items: [
      { type: "added",   text: "Flower mutations — bloomed flowers can carry a mutation that multiplies their sell value" },
      { type: "added",   text: "8 mutation types: Giant, Wet, Scorched, Frosted, Stellar, Prismatic, Gilded, Moonlit" },
      { type: "added",   text: "Mutations discovered via harvest or gift are registered in the Floral Codex" },
      { type: "changed", text: "Weather mutations only roll on fully bloomed flowers" },
      { type: "changed", text: "Growth bar now speeds up during rain and slows back down smoothly" },
      { type: "fixed",   text: "Rarity glow border was being overwritten by mutation colour in inventory" },
      { type: "fixed",   text: "Flowers received as gifts now appear in Botany Lab and Floral Codex" },
      { type: "fixed",   text: "Manipulated local saves with future timestamps are rejected in favour of cloud save" },
    ],
  },
  {
    version: "1.3.0",
    title:   "Quality of Life",
    items: [
      { type: "added",   text: "Collect All button — harvest every bloomed flower in one tap" },
      { type: "added",   text: "Plant All button — fills empty plots with your highest-rarity seeds automatically" },
      { type: "added",   text: "Buy All button on shop slots — purchase the entire stock in one click" },
      { type: "added",   text: "Convert All button in Botany Lab — runs as many conversions as possible at once" },
      { type: "added",   text: "My Profile button on the Social tab for quick access to your own profile" },
      { type: "added",   text: "Profile status message — set a short message displayed on your profile" },
    ],
  },
  {
    version: "1.2.2",
    title:   "Polish & Fixes",
    items: [
      { type: "fixed", text: "Harvest popup now appears immediately on harvest, not on the next plant action" },
      { type: "fixed", text: "Shop cards show a green '✓ Bought!' flash to confirm purchases" },
      { type: "fixed", text: "Codex descriptions no longer truncate on mobile — tap to expand" },
      { type: "fixed", text: "Plant tooltip correctly shows accelerated stage and countdown during rain" },
      { type: "fixed", text: "Username hidden on mobile HUD to reduce crowding" },
      { type: "fixed", text: "Weather countdown on mobile shows minutes only" },
    ],
  },
  {
    version: "1.2.1",
    title:   "Bug Fixes & Balancing",
    items: [
      { type: "fixed",   text: "Progress no longer lost on page refresh — save recovered automatically if cloud write was in-flight" },
      { type: "fixed",   text: "Signing in after a guest session no longer overwrites your cloud progress" },
      { type: "fixed",   text: "Two devices on the same account now load the most recent save correctly" },
      { type: "fixed",   text: "Removed stray flower previews from Botany Lab tier cards" },
      { type: "changed", text: "Farm upgrade costs rebalanced" },
    ],
  },
  {
    version: "1.2.0",
    title:   "The Botany Update",
    items: [
      { type: "added",   text: "Botany Lab — convert harvested blooms into a seed of the next rarity" },
      { type: "added",   text: "Exalted rarity — 7 new flowers obtainable only through Botany" },
      { type: "added",   text: "20 new flowers across all rarities" },
      { type: "added",   text: "Purchasable shop slots — buy up to 12 flower slots independently of farm size" },
      { type: "added",   text: "Rectangular farm expansion — up to 9×6 via three new upgrade tiers" },
      { type: "added",   text: "Exalted added to Floral Codex with its own filter and breakdown column" },
      { type: "added",   text: "Leaderboard can now be sorted by codex completion percentage" },
      { type: "changed", text: "Shop countdown timer removed from HUD" },
    ],
  },
  {
    version: "1.1.2",
    title:   "Weather Tick Fix",
    items: [
      { type: "fixed", text: "Weather events now last longer and transition less frequently" },
      { type: "fixed", text: "More reliable weather tick timing via 15-minute cron interval" },
      { type: "added", text: "Client-side fallback advances weather immediately on page load if expired" },
      { type: "added", text: "Offline banner now greets you by name with a time-of-day message" },
    ],
  },
];

export const LATEST_CHANGELOG_VERSION = CHANGELOGS[0].version;

export const CHANGELOG_ITEM_ICONS: Record<ChangelogItemType, string> = {
  added:   "✨",
  fixed:   "🔧",
  changed: "🔄",
};
