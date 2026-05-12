// Display helpers for crafting queue entries — used by both CraftingTab
// (for the queue row) and the global craft-completion banner in App.tsx.

import { GEAR, type GearType } from "../data/gear";
import { CONSUMABLE_RECIPE_MAP, type ConsumableId } from "../data/consumables";
import { UNIVERSAL_ESSENCE_DISPLAY } from "../data/essences";
import type { CraftingQueueEntry } from "../store/gameStore";

/** Returns the emoji, optional sprite, and display name for a crafting queue entry. */
export function queueEntryDisplay(entry: CraftingQueueEntry): { emoji: string; sprite?: string; name: string } {
  // Support legacy entries that only have gearType (not kind/outputId)
  const kind     = entry.kind     ?? "gear";
  const outputId = entry.outputId ?? (entry as unknown as { gearType?: string }).gearType ?? "";

  if (kind === "gear") {
    const def = GEAR[outputId as GearType];
    return { emoji: def?.emoji ?? "⚙️", sprite: def?.sprite, name: def?.name ?? outputId };
  }
  if (kind === "consumable") {
    const crec = CONSUMABLE_RECIPE_MAP[outputId as ConsumableId];
    return { emoji: crec?.emoji ?? "🧪", sprite: crec?.sprite, name: crec?.name ?? outputId };
  }
  if (kind === "essence") {
    // outputId is the essence type (currently only "universal")
    if (outputId === "universal") return { emoji: UNIVERSAL_ESSENCE_DISPLAY.emoji, sprite: UNIVERSAL_ESSENCE_DISPLAY.sprite, name: "Universal Essence" };
    return { emoji: "✨", name: outputId };
  }
  // attunement — outputId is the rarity string
  const capitalized = outputId.charAt(0).toUpperCase() + outputId.slice(1);
  return { emoji: "💉", sprite: "/sprites/consumables/infuser.png", name: `${capitalized} Infuser` };
}
