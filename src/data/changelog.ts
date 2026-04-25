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
