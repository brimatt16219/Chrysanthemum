// Shared by attune-start / attune-collect / attune-cancel.
// Mirrors the in-page alchemy-infuse data; keep aligned when species or
// mutation pools change. The duration formula here matches
// src/data/gear-recipes.ts attunementDurationMs() — keep them in sync.

export const SPECIES_RARITY: Record<string, string> = {
  quickgrass: "common",    dustweed: "common",       sprig: "common",
  dewdrop: "common",       pebblebloom: "common",    ember_moss: "common",
  dandelion: "common",     clover: "common",          violet: "common",
  lemongrass: "common",    daisy: "common",           honeywort: "common",
  buttercup: "common",     dawnpetal: "common",       poppy: "common",
  chamomile: "common",     marigold: "common",        sunflower: "common",
  coppercup: "common",     ivybell: "common",         thornberry: "common",
  saltmoss: "common",      ashpetal: "common",        snowdrift: "common",
  swiftbloom: "uncommon",  shortcress: "uncommon",    thornwhistle: "uncommon",
  starwort: "uncommon",    mintleaf: "uncommon",      tulip: "uncommon",
  inkbloom: "uncommon",    hyacinth: "uncommon",      snapdragon: "uncommon",
  beebalm: "uncommon",     candleflower: "uncommon",  carnation: "uncommon",
  ribbonweed: "uncommon",  hibiscus: "uncommon",      wildberry: "uncommon",
  frostbell: "uncommon",   bluebell: "uncommon",      cherry_blossom: "uncommon",
  rose: "uncommon",        peacockflower: "uncommon", bamboo_bloom: "uncommon",
  hummingbloom: "uncommon",water_lily: "uncommon",    lanternflower: "uncommon",
  dovebloom: "uncommon",   coral_bells: "uncommon",   sundew: "uncommon",
  bubblebloom: "uncommon",
  flashpetal: "rare",      rushwillow: "rare",        sweetheart_lily: "rare",
  glassbell: "rare",       stormcaller: "rare",       lavender: "rare",
  amber_crown: "rare",     peach_blossom: "rare",     foxglove: "rare",
  butterbloom: "rare",     peony: "rare",             tidebloom: "rare",
  starweave: "rare",       wisteria: "rare",          dreamcup: "rare",
  coralbell: "rare",       foxfire: "rare",           bird_of_paradise: "rare",
  solarbell: "rare",       moonpetal: "rare",         orchid: "rare",
  duskrose: "rare",        passionflower: "rare",     glasswing: "rare",
  mirror_orchid: "rare",   stargazer_lily: "rare",    prism_lily: "rare",
  dusk_orchid: "rare",
  firstbloom: "legendary",    haste_lily: "legendary",     verdant_crown: "legendary",
  ironwood_bloom: "legendary",sundial: "legendary",         lotus: "legendary",
  candy_blossom: "legendary", prismbark: "legendary",       dolphinia: "legendary",
  ghost_orchid: "legendary",  nestbloom: "legendary",       black_rose: "legendary",
  pumpkin_blossom: "legendary",starburst_lily: "legendary",  sporebloom: "legendary",
  fire_lily: "legendary",     stargazer: "legendary",       fullmoon_bloom: "legendary",
  ice_crown: "legendary",     diamond_bloom: "legendary",   oracle_eye: "legendary",
  halfmoon_bloom: "legendary",aurora_bloom: "legendary",    mirrorpetal: "legendary",
  emberspark: "legendary",
  phoenix_lily: "legendary",  eclipse_bloom: "legendary",   tempest_orchid: "legendary",
  blightmantle: "legendary",  cosmosbloom: "legendary",     dreamgust: "legendary",
  blink_rose: "mythic",    dawnfire: "mythic",        moonflower: "mythic",
  jellybloom: "mythic",    celestial_bloom: "mythic", void_blossom: "mythic",
  seraph_wing: "mythic",   solar_rose: "mythic",      nebula_drift: "mythic",
  superbloom: "mythic",    wanderbloom: "mythic",     chrysanthemum: "mythic",
  solarburst: "mythic",    tidalune: "mythic",        whisperleaf: "mythic",
  crystalmind: "mythic",
  umbral_bloom: "exalted",  obsidian_rose: "exalted", duskmantle: "exalted",
  graveweb: "exalted",      nightwing: "exalted",     ashenveil: "exalted",
  voidfire: "exalted",      void_chrysalis: "exalted",starloom: "exalted",
  dreambloom: "prismatic",  fairy_blossom: "prismatic", lovebind: "prismatic",
  eternal_heart: "prismatic",nova_bloom: "prismatic",  princess_blossom: "prismatic",
  the_first_bloom: "prismatic",
  // Event-exclusive
  sakura_blossom: "prismatic",
  // ── New common flowers ──────────────────────────────────────────────────
  cloudveil: "common",      pepperbloom: "common",      flurrysprig: "common",
  showerbloom: "common",    creamcap: "common",          duskling: "common",
  moongrass: "common",      owlsage: "common",           brewleaf: "common",
  hexblossom: "common",     starfleck: "common",         cometail: "common",
  // ── New uncommon flowers ─────────────────────────────────────────────────
  glacierbud: "uncommon",   cloudgrass: "uncommon",      chimebloom: "uncommon",
  evenfall: "uncommon",     sundrift: "uncommon",         moonspan: "uncommon",
  tanglewort: "uncommon",   medalwort: "uncommon",        topazbloom: "uncommon",
  // ── New rare flowers ─────────────────────────────────────────────────────
  blazecrown: "rare",       terracotta: "rare",           frostmark: "rare",
  coldsnap: "rare",         voidpetal: "rare",
  // ── New legendary flower ─────────────────────────────────────────────────
  galebloom: "legendary",
  // ── New mythic flowers ───────────────────────────────────────────────────
  infernopetal: "mythic",   anchorweed: "mythic",        worldroot: "mythic",
  clearingbloom: "mythic",  permafrost: "mythic",         frostspine: "mythic",
  tempest_eye: "mythic",    thundercrown: "mythic",       moonsmile: "mythic",
  dreamshade: "mythic",     gravewilt: "mythic",
};

export const SPECIES_TYPES: Record<string, string[]> = {
  quickgrass: ["grove"],             dustweed: ["zephyr","shadow"],       sprig: ["grove"],
  dewdrop: ["tide"],                 pebblebloom: ["grove"],              ember_moss: ["blaze","grove"],
  dandelion: ["grove","zephyr"],     clover: ["grove","fairy"],           violet: ["fairy","arcane"],
  lemongrass: ["grove","solar"],     daisy: ["grove","fairy"],            honeywort: ["grove","solar"],
  buttercup: ["fairy","solar"],      dawnpetal: ["lunar","solar"],        poppy: ["blaze","grove"],
  chamomile: ["grove","solar"],      marigold: ["solar","grove"],         sunflower: ["solar"],
  coppercup: ["grove"],              ivybell: ["grove","tide"],           thornberry: ["grove"],
  saltmoss: ["tide"],                ashpetal: ["shadow","zephyr"],       snowdrift: ["frost"],
  swiftbloom: ["zephyr"],            shortcress: ["grove"],               thornwhistle: ["grove","blaze"],
  starwort: ["stellar"],             mintleaf: ["grove","frost"],         tulip: ["fairy","grove"],
  inkbloom: ["arcane","shadow"],     hyacinth: ["blaze","fairy"],         snapdragon: ["blaze","arcane"],
  beebalm: ["grove","solar"],        candleflower: ["blaze","arcane"],    carnation: ["fairy"],
  ribbonweed: ["fairy"],             hibiscus: ["solar","blaze"],         wildberry: ["grove"],
  frostbell: ["frost"],              bluebell: ["fairy","tide"],          cherry_blossom: ["fairy","grove"],
  rose: ["fairy"],                   peacockflower: ["arcane","zephyr"],  bamboo_bloom: ["grove","zephyr"],
  hummingbloom: ["zephyr","fairy"],  water_lily: ["tide"],                lanternflower: ["blaze","arcane"],
  dovebloom: ["zephyr","fairy"],     coral_bells: ["tide","fairy"],       sundew: ["grove","shadow"],
  bubblebloom: ["tide","fairy"],
  flashpetal: ["storm"],             rushwillow: ["zephyr","tide"],       sweetheart_lily: ["fairy"],
  glassbell: ["arcane","stellar"],   stormcaller: ["storm"],              lavender: ["fairy","arcane"],
  amber_crown: ["solar","blaze"],    peach_blossom: ["grove","fairy"],    foxglove: ["shadow","arcane"],
  butterbloom: ["fairy","zephyr"],   peony: ["fairy"],                    tidebloom: ["tide"],
  starweave: ["stellar","arcane"],   wisteria: ["fairy","arcane"],        dreamcup: ["fairy","arcane"],
  coralbell: ["tide"],               foxfire: ["blaze","arcane"],         bird_of_paradise: ["zephyr","solar"],
  solarbell: ["solar"],              moonpetal: ["lunar"],                orchid: ["fairy","arcane"],
  duskrose: ["lunar","shadow"],      passionflower: ["arcane","storm"],   glasswing: ["arcane"],
  mirror_orchid: ["arcane","stellar"],stargazer_lily: ["stellar"],        prism_lily: ["arcane","stellar"],
  dusk_orchid: ["lunar","solar"],
  firstbloom: ["solar","fairy"],     haste_lily: ["zephyr","storm"],      verdant_crown: ["grove","fairy"],
  ironwood_bloom: ["grove"],         sundial: ["solar","arcane"],         lotus: ["tide","arcane"],
  candy_blossom: ["fairy"],          prismbark: ["grove","arcane"],       dolphinia: ["tide"],
  ghost_orchid: ["shadow","arcane"], nestbloom: ["grove","fairy"],        black_rose: ["shadow"],
  pumpkin_blossom: ["shadow","grove"],starburst_lily: ["stellar","storm"],sporebloom: ["grove","shadow"],
  fire_lily: ["blaze"],              stargazer: ["stellar"],              fullmoon_bloom: ["lunar"],
  ice_crown: ["frost"],              diamond_bloom: ["frost","arcane"],   oracle_eye: ["arcane","shadow"],
  halfmoon_bloom: ["lunar"],         aurora_bloom: ["stellar","arcane"],  mirrorpetal: ["arcane","stellar"],
  emberspark: ["blaze","storm"],
  phoenix_lily: ["blaze","frost"],   eclipse_bloom: ["lunar","solar"],    tempest_orchid: ["tide","storm"],
  blightmantle: ["grove","shadow"],  cosmosbloom: ["arcane","stellar"],   dreamgust: ["fairy","zephyr"],
  blink_rose: ["arcane","shadow"],   dawnfire: ["solar","blaze"],         moonflower: ["lunar"],
  jellybloom: ["tide","arcane"],     celestial_bloom: ["stellar"],        void_blossom: ["shadow","arcane"],
  seraph_wing: ["zephyr","fairy"],   solar_rose: ["solar"],               nebula_drift: ["stellar","arcane"],
  superbloom: ["storm","stellar"],   wanderbloom: ["zephyr","arcane"],    chrysanthemum: ["arcane","stellar","fairy"],
  solarburst: ["blaze","solar"],     tidalune: ["lunar","tide"],          whisperleaf: ["grove","zephyr"],
  crystalmind: ["frost","arcane"],
  umbral_bloom: ["shadow","lunar"],  obsidian_rose: ["shadow"],           duskmantle: ["shadow","lunar"],
  graveweb: ["shadow"],              nightwing: ["shadow","zephyr"],      ashenveil: ["shadow","blaze"],
  voidfire: ["shadow","blaze"],      void_chrysalis: ["arcane"],          starloom: ["stellar"],
  dreambloom: ["fairy","arcane"],    fairy_blossom: ["fairy"],            lovebind: ["fairy","arcane"],
  eternal_heart: ["fairy","solar"],  nova_bloom: ["stellar","storm","blaze"],princess_blossom: ["fairy","arcane"],
  the_first_bloom: ["arcane","stellar"],
  // ── New common flowers ──────────────────────────────────────────────────
  cloudveil: ["storm"],              pepperbloom: ["blaze"],              flurrysprig: ["frost"],
  showerbloom: ["storm","tide"],     creamcap: ["frost","fairy"],          duskling: ["lunar"],
  moongrass: ["lunar"],              owlsage: ["shadow","arcane"],         brewleaf: ["arcane","grove"],
  hexblossom: ["arcane"],            starfleck: ["stellar"],               cometail: ["stellar"],
  // ── New uncommon flowers ─────────────────────────────────────────────────
  glacierbud: ["frost"],             cloudgrass: ["storm"],               chimebloom: ["storm","arcane"],
  evenfall: ["lunar","shadow"],      sundrift: ["solar","zephyr"],         moonspan: ["lunar","tide"],
  tanglewort: ["shadow"],            medalwort: ["stellar"],               topazbloom: ["stellar"],
  // ── New rare flowers ─────────────────────────────────────────────────────
  blazecrown: ["blaze"],             terracotta: ["grove","blaze"],        frostmark: ["frost"],
  coldsnap: ["frost","storm"],       voidpetal: ["shadow","arcane"],
  // ── New legendary flower ─────────────────────────────────────────────────
  galebloom: ["zephyr"],
  // ── New mythic flowers ───────────────────────────────────────────────────
  infernopetal: ["blaze"],           anchorweed: ["tide","shadow"],        worldroot: ["grove","arcane"],
  clearingbloom: ["grove","solar"],  permafrost: ["frost"],                frostspine: ["frost","storm"],
  tempest_eye: ["storm"],            thundercrown: ["storm"],              moonsmile: ["lunar","fairy"],
  dreamshade: ["fairy","arcane"],    gravewilt: ["shadow"],
};

export const INFUSE_GOLD_COST: Record<string, [number, number, number, number]> = {
  common:    [     15,      60,      200,       700],
  uncommon:  [     75,     300,      900,     3_000],
  rare:      [    300,   1_200,    4_000,    14_000],
  legendary: [  1_200,   5_000,   16_000,    55_000],
  mythic:    [  5_000,  20_000,   70_000,   250_000],
  exalted:   [ 20_000,  80_000,  280_000, 1_000_000],
  prismatic: [ 80_000, 300_000,1_000_000, 3_500_000],
};

const TIER_MUTATION_WEIGHTS: [string, number][][] = [
  [["wet",25],["windstruck",22],["frozen",20],["scorched",20],["shocked",6],["giant",4],["moonlit",2],["golden",1],["rainbow",0]],
  [["wet",13],["windstruck",9],["frozen",13],["scorched",13],["shocked",13],["giant",13],["moonlit",12],["golden",7],["rainbow",7]],
  [["wet",3],["windstruck",1],["frozen",4],["scorched",4],["shocked",17],["giant",22],["moonlit",17],["golden",16],["rainbow",16]],
  [["wet",0],["windstruck",0],["frozen",0],["scorched",0],["shocked",12],["giant",25],["moonlit",18],["golden",22],["rainbow",23]],
];

export function rollMutation(tier: 1 | 2 | 3 | 4): string {
  const pool   = TIER_MUTATION_WEIGHTS[tier - 1];
  const total  = pool.reduce((s, [, w]) => s + w, 0);
  let   roll   = Math.random() * total;
  for (const [mutation, weight] of pool) {
    if (weight === 0) continue;
    roll -= weight;
    if (roll <= 0) return mutation;
  }
  return pool[pool.length - 1][0];
}

/** Compute mutation tier from effective essence (matching essence counts ×2). */
export function computeTier(effectiveEssence: number): 1 | 2 | 3 | 4 {
  if (effectiveEssence >= 40) return 4;
  if (effectiveEssence >= 20) return 3;
  if (effectiveEssence >= 8)  return 2;
  return 1;
}

// ── Duration formula (mirrors src/data/gear-recipes.ts attunementDurationMs) ─

const ATTUNEMENT_TIER_BASE_MS: Record<1 | 2 | 3 | 4, number> = {
  1: 5  * 60_000,  //  5 min
  2: 15 * 60_000,  // 15 min
  3: 30 * 60_000,  // 30 min
  4: 90 * 60_000,  //  1h 30m
};

const ATTUNEMENT_RARITY_MULT: Record<string, number> = {
  common:    1.0,
  uncommon:  1.25,
  rare:      1.5,
  legendary: 2.0,
  mythic:    3.0,
  exalted:   4.0,
  prismatic: 5.0,
};

export function attunementDurationMs(tier: 1 | 2 | 3 | 4, rarity: string): number {
  const base = ATTUNEMENT_TIER_BASE_MS[tier];
  const mult = ATTUNEMENT_RARITY_MULT[rarity] ?? 1.0;
  return Math.round(base * mult);
}

// ── Inventory helpers ────────────────────────────────────────────────────────

export type InvItem = { speciesId: string; quantity: number; mutation?: string | null; isSeed?: boolean };

export function addOrIncrement(inv: InvItem[], speciesId: string, mutation: string | undefined): InvItem[] {
  const idx = inv.findIndex(
    (i) => i.speciesId === speciesId && (i.mutation ?? undefined) === mutation && !i.isSeed
  );
  return idx >= 0
    ? inv.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i)
    : [...inv, { speciesId, quantity: 1, mutation, isSeed: false }];
}

export function deductOne(inv: InvItem[], speciesId: string, mutation: string | undefined): InvItem[] | null {
  const idx = inv.findIndex(
    (i) => i.speciesId === speciesId && (i.mutation ?? undefined) === mutation && !i.isSeed && i.quantity > 0
  );
  if (idx < 0) return null;
  return inv
    .map((i, n) => n === idx ? { ...i, quantity: i.quantity - 1 } : i)
    .filter((i) => i.quantity > 0);
}
