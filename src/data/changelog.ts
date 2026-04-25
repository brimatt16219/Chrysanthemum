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
